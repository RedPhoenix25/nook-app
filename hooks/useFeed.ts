import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { sendPushNotification } from "@/hooks/usePushNotifications";
import type { Note, Profile } from "@/types/database.types";
import { getDb, recordMutation } from "@/lib/database";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { useSpace } from "@/app/_layout";

// Fallback UUID v4 generator for React Native
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const sortNotes = (notes: Note[]) => {
  return [...notes].sort((a, b) => {
    if (a.is_pinned === b.is_pinned) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return a.is_pinned ? -1 : 1;
  });
};

export function useFeed() {
  const [loading, setLoading] = useState(true);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const isInitialLoad = useRef(true);

  const { isOnline, lastSyncTime } = useSyncEngine();

  const { activeSpaceId, spaces, currentUserProfile: contextUserProfile } = useSpace();

  useEffect(() => {
    let isMounted = true;
    
    async function loadData() {
      if (!activeSpaceId) {
        if (isMounted) {
          setSpaceId(null);
          setPartner(null);
          setNotes([]);
          if (spaces.length === 0) {
            setError("No active space found. You may need to create a new one.");
          } else {
            setError(null);
          }
          if (isInitialLoad.current) setLoading(false);
          isInitialLoad.current = false;
        }
        return;
      }

      // Only show full-screen spinner on the very first load
      if (isInitialLoad.current && isMounted) {
        setLoading(true);
      }

      try {
        const user = await getCurrentUser();
        if (!user) {
          if (isMounted) setError("Not authenticated");
          return;
        }

        const currentSpaceMeta = spaces.find(s => s.id === activeSpaceId);
        
        if (isMounted) {
          setSpaceId(activeSpaceId);
          setError(null); // Clear error on valid space
          if (contextUserProfile) {
            setCurrentUserProfile(contextUserProfile);
          } else {
            setCurrentUserProfile({ id: user.id } as Profile); // Simple fallback
          }
          
          if (currentSpaceMeta?.partner) {
            setPartner(currentSpaceMeta.partner as unknown as Profile);
          } else {
            setPartner(null);
          }
        }

        // Fetch notes from LOCAL SQLite
        const db = await getDb();
        const localNotes = await db.getAllAsync<any>(
          `SELECT * FROM notes WHERE space_id = ? ORDER BY is_pinned DESC, created_at DESC`,
          activeSpaceId
        );
        
        // SQLite stores booleans as 0/1. Map them back to boolean
        const mappedNotes = localNotes.map(n => ({
          ...n,
          is_pinned: Boolean(n.is_pinned)
        }));
        
        console.log(`[useFeed] Fetched ${mappedNotes.length} notes from SQLite for space ${activeSpaceId}`);
        if (isMounted) {
          setNotes(mappedNotes);
          setError(null);
        }

      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) {
          isInitialLoad.current = false;
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [activeSpaceId, spaces, lastSyncTime]); // Reload from local db when sync completes or active space changes

  const refreshFeed = useCallback(async () => {
    // If using local db, forceSync handles the refresh.
  }, []);

  const addNote = async (content: string, type: "text" | "photo" | "audio" = "text", mediaUrl?: string) => {
    if (!spaceId || !currentUserProfile) return { data: null, error: new Error("Missing data") };
    
    const db = await getDb();
    const newNoteId = generateUUID(); // Generate valid UUIDv4 locally
    
    const now = new Date().toISOString();
    const newNote = {
      id: newNoteId,
      space_id: spaceId,
      author_id: currentUserProfile.id,
      content,
      note_type: type,
      media_url: mediaUrl || null,
      is_pinned: 0,
      created_at: now,
      updated_at: now,
    };

    try {
      // 1. Save to SQLite
      await db.runAsync(
        `INSERT INTO notes (id, space_id, author_id, content, media_url, note_type, created_at, updated_at, is_pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newNote.id, newNote.space_id, newNote.author_id, newNote.content, newNote.media_url, newNote.note_type, newNote.created_at, newNote.updated_at, newNote.is_pinned
      );

      // 2. Queue mutation
      await recordMutation(db, 'INSERT', 'notes', newNote.id, newNote);

      // 3. Update UI
      setNotes((prev) => sortNotes([{ ...newNote, is_pinned: false } as Note, ...prev]));
      
      // 4. Send push notification if online
      if (isOnline && partner?.expo_push_token) {
        const title = type === "photo" ? "📸 New Photo" : "📝 New Note";
        const body = `${currentUserProfile.display_name} shared something with you.`;
        sendPushNotification(partner.expo_push_token, title, body);
      }
      
      return { data: newNote, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  const updateNote = async (noteId: string, content: string, mediaUrl?: string) => {
    const db = await getDb();
    const updatePayload = { content, media_url: mediaUrl || null, updated_at: new Date().toISOString() };
    
    try {
      await db.runAsync(
        `UPDATE notes SET content = ?, media_url = ?, updated_at = ? WHERE id = ?`,
        updatePayload.content, updatePayload.media_url, updatePayload.updated_at, noteId
      );
      
      await recordMutation(db, 'UPDATE', 'notes', noteId, updatePayload);
      
      setNotes((prev) => sortNotes(prev.map((n) => n.id === noteId ? { ...n, ...updatePayload } : n)));
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  const togglePinNote = async (noteId: string, currentPinStatus: boolean) => {
    const db = await getDb();
    const newStatus = !currentPinStatus;
    const updatePayload = { is_pinned: newStatus, updated_at: new Date().toISOString() };
    
    try {
      await db.runAsync(
        `UPDATE notes SET is_pinned = ?, updated_at = ? WHERE id = ?`,
        newStatus ? 1 : 0, updatePayload.updated_at, noteId
      );
      
      await recordMutation(db, 'UPDATE', 'notes', noteId, updatePayload);
      
      setNotes((prev) => sortNotes(prev.map((n) => n.id === noteId ? { ...n, is_pinned: newStatus } : n)));
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  };

  const deleteNote = async (noteId: string) => {
    const db = await getDb();
    try {
      await db.runAsync(`DELETE FROM notes WHERE id = ?`, noteId);
      await recordMutation(db, 'DELETE', 'notes', noteId, null);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  };

  return {
    loading,
    spaceId,
    partner,
    currentUserProfile,
    notes,
    error,
    addNote,
    updateNote,
    togglePinNote,
    deleteNote,
    refreshFeed,
  };
}
