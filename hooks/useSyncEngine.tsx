import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { getDb, getPendingMutations, clearMutation } from '@/lib/database';
import { useSpace } from '@/app/_layout';
import * as FileSystem from 'expo-file-system/legacy';

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
  // Use refs as the REAL guards — React state updates are async and stale closures
  // in Realtime callbacks would capture outdated values otherwise.
  const isSyncingRef = useRef(false);
  const spacesRef = useRef<typeof spaces>([]);
  const isOnlineRef = useRef(true);
  
  const { spaces } = useSpace();

  // Keep refs in sync with state
  useEffect(() => { spacesRef.current = spaces; }, [spaces]);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      isOnlineRef.current = online;
      if (online) {
        syncData();
      }
    });

    return () => unsubscribe();
  }, []);

  // Also sync when spaces list changes (e.g., joining a new space)
  useEffect(() => {
    if (isOnline && spaces.length > 0) {
      syncData();
    }
  }, [spaces]);

  // Realtime subscriptions for data — use a stable callback via a ref
  const syncDataRef = useRef<() => void>(() => {});

  useEffect(() => {
    const channel = supabase.channel('data-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => syncDataRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prompt_responses' }, () => syncDataRef.current())
      .subscribe();

    // Fallback sync interval every 10 seconds to catch missed realtime events
    const intervalId = setInterval(() => syncDataRef.current(), 10000);

    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(intervalId);
    };
  }, []); // Only subscribe once on mount

  const syncData = async () => {
    if (isSyncingRef.current || !isOnlineRef.current || spacesRef.current.length === 0) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const db = await getDb();
      const currentSpaces = spacesRef.current;
      if (currentSpaces.length === 0) return;
      
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
                // File doesn't exist or cannot be read — clear the media_url so
                // the note record still syncs without a broken local file:// URL.
                console.log("Local file missing — clearing media_url and proceeding with sync.");
                payload.media_url = null;
                await db.runAsync(
                  `UPDATE ${mutation.table_name} SET media_url = NULL WHERE id = ?`,
                  mutation.record_id
                );
                await db.runAsync(
                  `UPDATE offline_mutations SET payload = ? WHERE id = ?`,
                  JSON.stringify(payload), mutation.id
                );
              }

              if (arrayBuffer) {
                const { decode } = await import("base64-arraybuffer");
                const decodedBuffer = decode(arrayBuffer);
                
                const contentType = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : `audio/${ext}`;
                console.log('[SyncEngine] Attempting storage upload:', fileName, contentType);
                const { error: uploadError } = await supabase.storage.from('space_media').upload(fileName, decodedBuffer, {
                  contentType,
                });
                
                if (uploadError) {
                  console.error('[SyncEngine] Storage upload error:', JSON.stringify(uploadError));
                  throw uploadError;
                }
                
                const { data: publicUrlData } = supabase.storage.from('space_media').getPublicUrl(fileName);
                payload.media_url = `${publicUrlData.publicUrl}${aspectRatio}`;
                console.log('[SyncEngine] Upload success. Public URL:', payload.media_url);
                
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
              // Clear broken media_url to avoid blocking the queue permanently
              payload.media_url = null;
              await db.runAsync(
                `UPDATE ${mutation.table_name} SET media_url = NULL WHERE id = ?`,
                mutation.record_id
              );
            }
          }

          // Fix column name mismatch: local SQLite stores created_at/updated_at but
          // Supabase prompt_responses uses submitted_at. Remap before pushing.
          if (mutation.table_name === 'prompt_responses') {
            if (payload.created_at && !payload.submitted_at) {
              payload.submitted_at = payload.created_at;
            }
            // Strip local-only columns that don't exist on the cloud table
            delete payload.created_at;
            delete payload.updated_at;
          }

          if (mutation.mutation_type === 'INSERT') {
            console.log('[SyncEngine] Inserting to', mutation.table_name, '| media_url:', payload.media_url);
            const { error } = await supabase.from(mutation.table_name).insert(payload);
            if (error && error.code !== '23505') {
              console.error('[SyncEngine] Insert error:', JSON.stringify(error));
              throw error;
            }
          } else if (mutation.mutation_type === 'UPDATE') {
            // Last-Write-Wins: Only update the remote row if our local updated_at is newer or equal.
            // If the remote row is newer, the .lte() condition will fail to match, 0 rows will update,
            // and we silently discard our old mutation.
            let query = supabase.from(mutation.table_name).update(payload).eq('id', mutation.record_id);
            if (payload.updated_at) {
              query = query.lte('updated_at', payload.updated_at);
            }
            const { error } = await query;
            if (error) throw error;
          } else if (mutation.mutation_type === 'DELETE') {
            const { error } = await supabase.from(mutation.table_name).delete().eq('id', mutation.record_id);
            if (error) throw error;
          }
          
          // Clear mutation after successful push
          await clearMutation(db, mutation.id);
        } catch (err: any) {
          // Auto-heal mutations that will NEVER succeed — clear them to unblock the queue
          const isUnrecoverable = 
            err.code === '22P02' || // Invalid UUID
            err.code === '42501' || // RLS permission denied — wrong user/space
            err.code === '23503' || // Foreign key violation — record no longer exists
            err.code === 'PGRST204' || // Column not found in schema — bad payload shape
            (err.message && err.message.includes('invalid input syntax for type uuid'));

          if (isUnrecoverable) {
            console.log(`[SyncEngine] Auto-clearing unrecoverable mutation ${mutation.id} (${err.code}):`, err.message);
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
      if (!user) return;

      const spaceIds = currentSpaces.map(s => s.id);

      // Pull Notes for all spaces
      const { data: notes } = await supabase.from('notes').select('*').in('space_id', spaceIds);
      if (notes) {
        console.log(`[SyncEngine] Pulled ${notes.length} notes from cloud.`);
        for (const note of notes) {
          // Last-Write-Wins (Pull): Only overwrite local if the cloud version is strictly newer,
          // OR if the local version doesn't exist. SQLite allows ON CONFLICT DO UPDATE.
          await db.runAsync(
            `INSERT INTO notes (id, space_id, author_id, content, media_url, note_type, created_at, updated_at, is_pinned)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               space_id = excluded.space_id,
               author_id = excluded.author_id,
               content = excluded.content,
               media_url = excluded.media_url,
               note_type = excluded.note_type,
               created_at = excluded.created_at,
               updated_at = excluded.updated_at,
               is_pinned = excluded.is_pinned
             WHERE excluded.updated_at > notes.updated_at OR notes.updated_at IS NULL`,
            note.id, note.space_id, note.author_id, note.content, note.media_url, note.note_type, note.created_at, note.updated_at, note.is_pinned ? 1 : 0
          );
        }

        // Delete local notes that no longer exist in Supabase (e.g. deleted by partner),
        // but ONLY if they don't have a pending mutation (i.e. they aren't waiting to sync).
        if (spaceIds.length > 0) {
          const cloudIds = notes.map(n => `'${n.id}'`).join(',');
          const spaceIdPlaceholders = spaceIds.map(id => `'${id}'`).join(',');
          
          // Get IDs of notes that still have pending mutations - these must not be deleted
          const pendingNoteIds = await db.getAllAsync<{ record_id: string }>(
            `SELECT record_id FROM offline_mutations WHERE table_name = 'notes'`
          );
          const pendingIds = pendingNoteIds.map(r => `'${r.record_id}'`).join(',');
          const pendingExclusion = pendingIds.length > 0 ? `AND id NOT IN (${pendingIds})` : '';

          if (cloudIds.length > 0) {
            await db.runAsync(
              `DELETE FROM notes WHERE space_id IN (${spaceIdPlaceholders}) AND id NOT IN (${cloudIds}) ${pendingExclusion}`
            );
          } else {
            await db.runAsync(
              `DELETE FROM notes WHERE space_id IN (${spaceIdPlaceholders}) ${pendingExclusion}`
            );
          }
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
      const { data: responses, error: responsesError } = await supabase.from('prompt_responses').select('*').in('space_id', spaceIds);
      console.log(`[SyncEngine] Pulled ${responses?.length ?? 0} prompt_responses from cloud. Error: ${responsesError?.message ?? 'none'}`);
      if (responses) {
        for (const pr of responses) {
          // Note: Supabase responses use 'submitted_at' for 'created_at'.
          await db.runAsync(
            `INSERT INTO prompt_responses (id, prompt_id, space_id, user_id, response_text, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               response_text = excluded.response_text,
               updated_at = excluded.updated_at
             WHERE excluded.updated_at > prompt_responses.updated_at`,
            pr.id, pr.prompt_id, pr.space_id, pr.user_id, pr.response_text, pr.submitted_at, pr.updated_at || pr.submitted_at
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
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  // Keep the ref always pointing to the latest version of syncData
  syncDataRef.current = syncData;

  return (
    <SyncContext.Provider value={{ isOnline, isSyncing, lastSyncTime, forceSync: syncData }}>
      {children}
    </SyncContext.Provider>
  );
}
