// ============================================================
// Nook App — Database Types
// Auto-typed against the Supabase PostgreSQL schema.
// Do NOT use `any` — all types must be explicitly defined.
// ============================================================

export type NoteType = "text" | "photo" | "checklist" | "audio";

// ------------------------------------------------------------------
// profiles
// ------------------------------------------------------------------
export interface Profile {
  id: string;               // FK → auth.users.id (UUID)
  display_name: string;
  avatar_url: string | null;
  expo_push_token: string | null;
  created_at: string;       // ISO 8601 timestamp
  updated_at: string;
}

// ------------------------------------------------------------------
// spaces
// ------------------------------------------------------------------
export interface Space {
  id: string;               // UUID
  invite_code: string;      // 6-char alphanumeric, unique
  created_by: string;       // FK → profiles.id
  name: string | null;
  created_at: string;
}

// ------------------------------------------------------------------
// space_members
// ------------------------------------------------------------------
export interface SpaceMember {
  id: string;               // UUID
  space_id: string;         // FK → spaces.id
  user_id: string;          // FK → profiles.id
  joined_at: string;
  is_active: boolean;
}

// ------------------------------------------------------------------
// daily_prompts
// ------------------------------------------------------------------
export interface DailyPrompt {
  id: string;               // UUID
  prompt_text: string;
  prompt_date: string;      // ISO date string YYYY-MM-DD
  space_id: string | null;  // FK → spaces.id
  author_id: string | null; // FK → profiles.id
  created_at: string;
}

// ------------------------------------------------------------------
// prompt_responses
// ------------------------------------------------------------------
export interface PromptResponse {
  id: string;               // UUID
  space_id: string;         // FK → spaces.id
  user_id: string;          // FK → profiles.id
  prompt_id: string;        // FK → daily_prompts.id
  response_text: string | null;
  media_url: string | null;
  submitted_at: string;
}

// ------------------------------------------------------------------
// notes
// ------------------------------------------------------------------
export interface Note {
  id: string;               // UUID
  space_id: string;         // FK → spaces.id
  author_id: string;        // FK → profiles.id
  content: string | null;
  media_url: string | null;
  note_type: NoteType;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          expo_push_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          expo_push_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          expo_push_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      spaces: {
        Row: {
          id: string;
          invite_code: string;
          created_by: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invite_code?: string;
          created_by: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invite_code?: string;
          created_by?: string;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "spaces_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      space_members: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          joined_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          joined_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          joined_at?: string;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "space_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      daily_prompts: {
        Row: {
          id: string;
          prompt_text: string;
          prompt_date: string;
          space_id: string | null;
          author_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_text: string;
          prompt_date: string;
          space_id?: string | null;
          author_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          prompt_text?: string;
          prompt_date?: string;
          space_id?: string | null;
          author_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_prompts_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_prompts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      prompt_responses: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          prompt_id: string;
          response_text: string | null;
          media_url: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          prompt_id: string;
          response_text?: string | null;
          media_url?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          prompt_id?: string;
          response_text?: string | null;
          media_url?: string | null;
          submitted_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          space_id: string;
          author_id: string;
          content: string | null;
          media_url: string | null;
          note_type: NoteType;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          author_id: string;
          content?: string | null;
          media_url?: string | null;
          note_type: NoteType;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          author_id?: string;
          content?: string | null;
          media_url?: string | null;
          note_type?: NoteType;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_invite_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      create_space: {
        Args: { space_name?: string };
        Returns: { space_id: string; invite_code: string };
      };
      join_space: {
        Args: { join_code: string };
        Returns: string;
      };
      delete_user_account: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
    };
    Enums: {
      note_type: NoteType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
