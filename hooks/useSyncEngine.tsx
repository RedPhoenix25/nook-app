import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { getDb, getPendingMutations, clearMutation } from '@/lib/database';
import { useSpace } from '@/app/_layout';
import * as FileSystem from 'expo-file-system';

interface SyncContextProps {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextProps>({
  isOnline: true,
  isSyncing: false,
  lastSyncTime: null,
  forceSync: async () => {},
});

export const useSyncEngine = () => useContext(SyncContext);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const { spaces } = useSpace();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      
      if (online) {
        syncData();
      }
    });

    return () => unsubscribe();
  }, [spaces]);

  // Also sync when spaces list changes (e.g., joining a new space)
  useEffect(() => {
    if (isOnline && spaces.length > 0) {
      syncData();
    }
  }, [spaces]);

  const syncData = async () => {
    if (isSyncing || !isOnline || spaces.length === 0) return;
    
    setIsSyncing(true);
    try {
      const db = await getDb();
      
      // 1. PUSH PENDING MUTATIONS TO SUPABASE
      const pendingMutations = await getPendingMutations(db);
      
      for (const mutation of pendingMutations) {
        try {
          let payload = mutation.payload ? JSON.parse(mutation.payload) : {};
          
          // Background Upload Interceptor
          if (payload.media_url && payload.media_url.startsWith('file://')) {
            const isImage = mutation.table_name === 'notes' ? payload.note_type === 'photo' : true; // heuristic, audio also handled
            
            let localUri = payload.media_url;
            let aspectRatio = '';
            
            if (localUri.includes('?ar=')) {
              const parts = localUri.split('?ar=');
              localUri = parts[0];
              aspectRatio = `?ar=${parts[1]}`;
            }

            const ext = localUri.split('.').pop()?.toLowerCase() || (isImage ? 'jpg' : 'm4a');
            const spaceId = payload.space_id;
            const fileName = `${spaceId}/${Date.now()}.${ext}`;
            
            try {
              let arrayBuffer;
              try {
                arrayBuffer = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
              } catch (e) {
                // File doesn't exist or cannot be read, skip upload
                console.log("Local file missing, skipping upload");
              }

              if (arrayBuffer) {
                const { decode } = await import("base64-arraybuffer");
                const decodedBuffer = decode(arrayBuffer);
                
                const contentType = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : `audio/${ext}`;
                const { error: uploadError } = await supabase.storage.from('space_media').upload(fileName, decodedBuffer, {
                  contentType,
                });
                
                if (uploadError) throw uploadError;
                
                const { data: publicUrlData } = supabase.storage.from('space_media').getPublicUrl(fileName);
                payload.media_url = `${publicUrlData.publicUrl}${aspectRatio}`;
                
                // Update local SQLite record with the new cloud URL so the UI stays in sync
                await db.runAsync(
                  `UPDATE ${mutation.table_name} SET media_url = ? WHERE id = ?`,
                  payload.media_url, mutation.record_id
                );
                
                // Update the mutation payload stored in the database so if push fails, we try with cloud URL next time
                await db.runAsync(
                  `UPDATE offline_mutations SET payload = ? WHERE id = ?`,
                  JSON.stringify(payload), mutation.id
                );
              }
            } catch (err) {
              console.error('Failed to upload background media:', err);
              // If file is missing locally, we still push the mutation without the media, or we could fail.
              // We will just let it push with the local file:// url which will be broken, but it avoids blocking the queue permanently.
            }
          }

          if (mutation.mutation_type === 'INSERT') {
            const { error } = await supabase.from(mutation.table_name).insert(payload);
            if (error && error.code !== '23505') throw error; // Ignore unique violations
          } else if (mutation.mutation_type === 'UPDATE') {
            const { error } = await supabase.from(mutation.table_name).update(payload).eq('id', mutation.record_id);
            if (error) throw error;
          } else if (mutation.mutation_type === 'DELETE') {
            const { error } = await supabase.from(mutation.table_name).delete().eq('id', mutation.record_id);
            if (error) throw error;
          }
          
          // Clear mutation after successful push
          await clearMutation(db, mutation.id);
        } catch (err: any) {
          // Auto-heal local dev edge cases for invalid UUIDs (code 22P02 or specific message)
          if (
            err.code === '22P02' || 
            (err.message && err.message.includes('invalid input syntax for type uuid'))
          ) {
            console.log('Auto-healing invalid UUID mutation', mutation.id);
            await clearMutation(db, mutation.id);
            continue;
          }
          
          console.error('Error syncing mutation', mutation.id, err);
          // Break the loop to maintain chronological order of mutations if one fails
          break; 
        }
      }

      // 2. PULL NEW DATA FROM SUPABASE
      // In a real production app, we would use a last_synced_at timestamp to only pull new records.
      // For simplicity in this local-first architecture, we'll pull all records and upsert them locally.
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Only pull if authenticated

      const spaceIds = spaces.map(s => s.id);

      // Pull Notes for all spaces
      const { data: notes } = await supabase.from('notes').select('*').in('space_id', spaceIds);
      if (notes) {
        for (const note of notes) {
          await db.runAsync(
            `INSERT OR REPLACE INTO notes (id, space_id, author_id, content, media_url, note_type, created_at, is_pinned)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            note.id, note.space_id, note.author_id, note.content, note.media_url, note.note_type, note.created_at, note.is_pinned ? 1 : 0
          );
        }
      }

      // Pull Daily Prompts for all spaces + global prompts
      // PostgREST doesn't support complex OR with IN cleanly in the JS client without `.or()`.
      const { data: prompts } = await supabase
        .from('daily_prompts')
        .select('*')
        .or(`space_id.in.(${spaceIds.join(',')}),space_id.is.null`);
        
      if (prompts) {
        for (const p of prompts) {
          await db.runAsync(
            `INSERT OR REPLACE INTO daily_prompts (id, space_id, author_id, prompt_date, prompt_text, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            p.id, p.space_id, p.author_id, p.prompt_date, p.prompt_text, p.created_at
          );
        }
      }

      // Pull Prompt Responses for all spaces
      const { data: responses } = await supabase.from('prompt_responses').select('*').in('space_id', spaceIds);
      if (responses) {
        for (const r of responses) {
          await db.runAsync(
            `INSERT OR REPLACE INTO prompt_responses (id, prompt_id, space_id, user_id, response_text, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            r.id, r.prompt_id, r.space_id, r.user_id, r.response_text, r.submitted_at, r.submitted_at
          );
        }
      }

      // Pull Prompt Bank (public.prompts)
      const { data: promptBank } = await (supabase as any).from('prompts').select('*').eq('is_active', true);
      if (promptBank) {
        for (const p of promptBank) {
          await db.runAsync(
            `INSERT OR REPLACE INTO prompts (id, category, question, is_active, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            p.id, p.category, p.question, p.is_active ? 1 : 0, p.created_at
          );
        }
      }

      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SyncContext.Provider value={{ isOnline, isSyncing, lastSyncTime, forceSync: syncData }}>
      {children}
    </SyncContext.Provider>
  );
}
