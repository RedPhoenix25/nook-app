import { useEffect, useState, useRef, useCallback } from "react";
import { getCurrentUser } from "@/lib/auth";
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

export function useDailyPrompt(spaceId: string | null, partner: Profile | null, currentUserProfile: Profile | null) {
  const [loading, setLoading] = useState(true);
  const [mainPromptItem, setMainPromptItem] = useState<PromptItem | null>(null);
  const [additionalPromptItems, setAdditionalPromptItems] = useState<PromptItem[]>([]);
  const { lastSyncTime } = useSyncEngine();

  const fetchPromptData = useCallback(async () => {
    if (!spaceId) return;
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const db = await getDb();

      // Fetch all prompts for today from SQLite
      let prompts = await db.getAllAsync<any>(
        `SELECT * FROM daily_prompts WHERE prompt_date = ? AND (space_id = ? OR space_id IS NULL) ORDER BY created_at ASC`,
        today, spaceId
      );

      // If no prompts exist (even offline), generate a new prompt locally
      if (prompts.length === 0) {
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
        prompts = [newPrompt];
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
            isCurrentUser: true,
          },
          partnerSlot: {
            displayName: partner?.display_name || "Partner",
            responseText: partnerResponse?.response_text || null,
            mediaUrl: partnerResponse?.media_url || null,
            isBlurred: partnerIsBlurred,
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
      setLoading(false);
    }
  }, [spaceId, partner, currentUserProfile, lastSyncTime]);

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
      
      // Update UI optimistically
      fetchPromptData();
      return { data: newResponse, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  useEffect(() => {
    fetchPromptData();
  }, [spaceId, partner, currentUserProfile, lastSyncTime]); // Reload from local db when sync completes

  return {
    loading,
    mainPromptItem,
    additionalPromptItems,
    refreshPrompt: fetchPromptData,
    submitResponse,
  };
}
