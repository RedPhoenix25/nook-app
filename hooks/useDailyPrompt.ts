import { useEffect, useState, useRef, useCallback } from "react";
import { getCurrentUser } from "@/lib/auth";
import { sendPushNotification } from "@/hooks/usePushNotifications";
import type { Profile } from "@/types/database.types";
import { getDb, recordMutation } from "@/lib/database";
import { useSyncEngine } from "@/hooks/useSyncEngine";

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export type DailyPrompt = {
  id: string;
  prompt_text: string;
  prompt_date: string;
  created_at: string;
};

export type PromptSlot = {
  displayName: string;
  responseText: string | null;
  mediaUrl: string | null;
  isBlurred: boolean;
  hasResponse: boolean; // true if a response exists in the DB, even if blurred
  isCurrentUser: boolean;
};

export type PromptItem = {
  prompt: DailyPrompt;
  mySlot: PromptSlot;
  partnerSlot: PromptSlot;
  hasResponded: boolean;
};

const FALLBACK_PROMPTS = [
  "What is a small thing your partner did recently that made you smile?",
  "What is your favorite memory from our first year together?",
  "If we had a free weekend right now, what would we do?",
  "What's a goal you want us to achieve together this year?",
];

// Module-level lock to prevent race conditions when generating a new daily prompt
let generatingPromptPromise: Promise<void> | null = null;

export function useDailyPrompt(spaceId: string | null, partner: Profile | null, currentUserProfile: Profile | null) {
  const [loading, setLoading] = useState(true);
  const [mainPromptItem, setMainPromptItem] = useState<PromptItem | null>(null);
  const [additionalPromptItems, setAdditionalPromptItems] = useState<PromptItem[]>([]);
  const { lastSyncTime } = useSyncEngine();
  const isInitialLoad = useRef(true);

  // Use stable primitive IDs to avoid re-renders when object references change
  const partnerId = partner?.id ?? null;
  const currentUserId = currentUserProfile?.id ?? null;

  const fetchPromptData = useCallback(async () => {
    if (!spaceId) return;
    try {
      // Only show the full-screen spinner on the very first load
      if (isInitialLoad.current) {
        setLoading(true);
      }
      const user = await getCurrentUser();
      if (!user) return;

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const db = await getDb();

      // Fetch all prompts for today from SQLite
      let prompts = await db.getAllAsync<any>(
        `SELECT * FROM daily_prompts WHERE prompt_date = ? AND (space_id = ? OR space_id IS NULL) ORDER BY created_at ASC`,
        today, spaceId
      );

      // If no prompts exist (even offline), generate a new prompt locally
      if (prompts.length === 0) {
        if (generatingPromptPromise) {
          // Another call is already generating the prompt. Wait for it, then re-query.
          await generatingPromptPromise;
          prompts = await db.getAllAsync<any>(
            `SELECT * FROM daily_prompts WHERE prompt_date = ? AND (space_id = ? OR space_id IS NULL) ORDER BY created_at ASC`,
            today, spaceId
          );
        } else {
          // Take the lock
          generatingPromptPromise = (async () => {
            // Fetch all previously asked prompts in this space
            const pastPrompts = await db.getAllAsync<any>(
              `SELECT prompt_text FROM daily_prompts WHERE space_id = ?`,
              spaceId
            );
            const usedTexts = new Set(pastPrompts.map(p => p.prompt_text));

            // Fetch the prompt bank
            const promptBank = await db.getAllAsync<any>(
              `SELECT question FROM prompts WHERE is_active = 1`
            );
            
            // Filter out used ones
            let availablePrompts = promptBank.filter(p => !usedTexts.has(p.question));

            // If we exhausted all prompts, recycle the whole bank (or fallback)
            if (availablePrompts.length === 0) {
              availablePrompts = promptBank.length > 0 ? promptBank : FALLBACK_PROMPTS.map(text => ({ question: text }));
            }

            const randomPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
            const randomText = randomPrompt.question || randomPrompt;

            const newPrompt = {
              id: generateUUID(),
              space_id: spaceId,
              author_id: user.id, // Must be a valid UUID for Supabase
              prompt_date: today,
              prompt_text: randomText,
              created_at: new Date().toISOString()
            };

            await db.runAsync(
              `INSERT INTO daily_prompts (id, space_id, author_id, prompt_date, prompt_text, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
              newPrompt.id, newPrompt.space_id, newPrompt.author_id, newPrompt.prompt_date, newPrompt.prompt_text, newPrompt.created_at
            );
            
            await recordMutation(db, 'INSERT', 'daily_prompts', newPrompt.id, newPrompt);
          })();

          await generatingPromptPromise;
          generatingPromptPromise = null;
          
          // Re-query to get the newly inserted prompt safely
          prompts = await db.getAllAsync<any>(
            `SELECT * FROM daily_prompts WHERE prompt_date = ? AND (space_id = ? OR space_id IS NULL) ORDER BY created_at ASC`,
            today, spaceId
          );
        }
      }

      // Fetch responses for these prompts
      let responses: any[] = [];
      if (prompts.length > 0) {
        const promptIds = prompts.map(p => `'${p.id}'`).join(',');
        responses = await db.getAllAsync<any>(
          `SELECT * FROM prompt_responses WHERE space_id = ? AND prompt_id IN (${promptIds})`,
          spaceId
        );
      }

      // Map to PromptItems
      const items: PromptItem[] = prompts.map(p => {
        const pResponses = responses?.filter(r => r.prompt_id === p.id) || [];
        const myResponse = pResponses.find((r) => r.user_id === user.id);
        const partnerResponse = pResponses.find((r) => r.user_id !== user.id);

        const iHaveResponded = !!myResponse;
        const partnerIsBlurred = !iHaveResponded || !partnerResponse;

        return {
          prompt: p as DailyPrompt,
          hasResponded: iHaveResponded,
          mySlot: {
            displayName: currentUserProfile?.display_name || "You",
            responseText: myResponse?.response_text || null,
            mediaUrl: myResponse?.media_url || null,
            isBlurred: false,
            hasResponse: !!myResponse,
            isCurrentUser: true,
          },
          partnerSlot: {
            displayName: partner?.display_name || "Partner",
            responseText: partnerResponse?.response_text || null,
            mediaUrl: partnerResponse?.media_url || null,
            isBlurred: partnerIsBlurred,
            hasResponse: !!partnerResponse,
            isCurrentUser: false,
          }
        };
      });

      if (items.length > 0) {
        setMainPromptItem(items[0]);
        setAdditionalPromptItems(items.slice(1));
      } else {
        setMainPromptItem(null);
        setAdditionalPromptItems([]);
      }

    } catch (error) {
      console.error("Error in useDailyPrompt:", error);
    } finally {
      isInitialLoad.current = false;
      setLoading(false);
    }
  }, [spaceId, partnerId, currentUserId, lastSyncTime]);

  const submitResponse = async (promptId: string, responseText: string) => {
    if (!spaceId) return { error: new Error("Space ID is missing") };
    const user = await getCurrentUser();
    if (!user) return { error: new Error("Not authenticated") };

    const db = await getDb();
    const newResponse = {
      id: generateUUID(),
      prompt_id: promptId,
      space_id: spaceId,
      user_id: user.id,
      response_text: responseText,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await db.runAsync(
        `INSERT INTO prompt_responses (id, prompt_id, space_id, user_id, response_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        newResponse.id, newResponse.prompt_id, newResponse.space_id, newResponse.user_id, newResponse.response_text, newResponse.created_at, newResponse.updated_at
      );
      
      await recordMutation(db, 'INSERT', 'prompt_responses', newResponse.id, newResponse);
      
      // Send nudge push notification to partner
      if (partner?.expo_push_token) {
        await sendPushNotification(
          partner.expo_push_token,
          "Prompt Answered! ✍️",
          `${currentUserProfile?.display_name || 'Your partner'} just answered today's prompt. Share yours to unlock it.`
        );
      }

      // Update UI optimistically
      fetchPromptData();
      return { data: newResponse, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  const updateResponse = async (promptId: string, responseText: string) => {
    if (!spaceId) return { error: new Error("Space ID is missing") };
    const user = await getCurrentUser();
    if (!user) return { error: new Error("Not authenticated") };

    const db = await getDb();
    
    // First, find the existing response ID to update
    const existing = await db.getFirstAsync<any>(
      `SELECT id, created_at FROM prompt_responses WHERE prompt_id = ? AND user_id = ?`,
      promptId, user.id
    );
    
    if (!existing) {
      return submitResponse(promptId, responseText);
    }

    const updatedResponse = {
      id: existing.id,
      prompt_id: promptId,
      space_id: spaceId,
      user_id: user.id,
      response_text: responseText,
      created_at: existing.created_at,
      updated_at: new Date().toISOString()
    };

    try {
      await db.runAsync(
        `UPDATE prompt_responses SET response_text = ?, updated_at = ? WHERE id = ?`,
        updatedResponse.response_text, updatedResponse.updated_at, updatedResponse.id
      );
      
      await recordMutation(db, 'UPDATE', 'prompt_responses', updatedResponse.id, updatedResponse);
      
      fetchPromptData();
      return { data: updatedResponse, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  useEffect(() => {
    fetchPromptData();
  }, [spaceId, partnerId, currentUserId, lastSyncTime]); // Reload from local db when sync completes

  return {
    loading,
    mainPromptItem,
    additionalPromptItems,
    refreshPrompt: fetchPromptData,
    submitResponse,
    updateResponse,
  };
}
