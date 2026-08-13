import { useState, useEffect } from "react";
import { useFeed } from "./useFeed";
import type { DailyPrompt, PromptResponse } from "@/types/database.types";
import { getDb } from "@/lib/database";
import { useSyncEngine } from "@/hooks/useSyncEngine";

export interface MemoryPrompt {
  prompt: DailyPrompt;
  myResponse: PromptResponse | null;
  partnerResponse: PromptResponse | null;
  isUnlocked: boolean;
}

export function useMemories() {
  const { spaceId, currentUserProfile, partner } = useFeed();
  const [memories, setMemories] = useState<MemoryPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const { lastSyncTime } = useSyncEngine();

  useEffect(() => {
    if (!spaceId || !currentUserProfile) return;

    async function fetchMemories() {
      setLoading(true);

      try {
        const db = await getDb();
        
        // Fetch responses
        const responses = await db.getAllAsync<any>(
          `SELECT * FROM prompt_responses WHERE space_id = ? ORDER BY created_at DESC`,
          spaceId
        );
        
        // Fetch prompts
        const prompts = await db.getAllAsync<any>(
          `SELECT * FROM daily_prompts WHERE space_id = ? OR space_id IS NULL`,
          spaceId
        );
        
        const promptsMap = new Map(prompts.map(p => [p.id, p]));

        // Group responses by prompt_id
        const grouped = new Map<string, MemoryPrompt>();

        responses.forEach((row: any) => {
          const prompt = promptsMap.get(row.prompt_id) as DailyPrompt;
          if (!prompt) return;

          if (!grouped.has(prompt.id)) {
            grouped.set(prompt.id, {
              prompt,
              myResponse: null,
              partnerResponse: null,
              isUnlocked: false,
            });
          }

          const group = grouped.get(prompt.id)!;
          
          if (row.user_id === currentUserProfile.id) {
            group.myResponse = row as PromptResponse;
          } else if (partner && row.user_id === partner.id) {
            group.partnerResponse = row as PromptResponse;
          }
          
          // If both exist, it's unlocked
          if (group.myResponse && group.partnerResponse) {
            group.isUnlocked = true;
          }
        });

        // Convert Map to array and sort by prompt date descending
        const memoriesArray = Array.from(grouped.values()).sort((a, b) => {
          return new Date(b.prompt.prompt_date).getTime() - new Date(a.prompt.prompt_date).getTime();
        });

        setMemories(memoriesArray);
      } catch (err) {
        console.error("Error fetching memories from SQLite:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMemories();
  }, [spaceId, currentUserProfile, partner, lastSyncTime]); // Reload from local db when sync completes

  return { memories, loading };
}
