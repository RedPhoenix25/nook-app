import * as SQLite from 'expo-sqlite';

// Initialize the database asynchronously
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const database = await SQLite.openDatabaseAsync('nook_v4.db');
    await initSchema(database);
    return database;
  })();

  return dbPromise;
}

async function initSchema(database: SQLite.SQLiteDatabase) {
  // PRAGMA for foreign keys and WAL mode for better performance
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      content TEXT,
      media_url TEXT,
      note_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT DEFAULT '1970-01-01T00:00:00.000Z',
      is_pinned INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_prompts (
      id TEXT PRIMARY KEY,
      space_id TEXT,
      author_id TEXT,
      prompt_date TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT DEFAULT '1970-01-01T00:00:00.000Z'
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_responses (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      space_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      response_text TEXT,
      media_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT DEFAULT '1970-01-01T00:00:00.000Z'
    );

    CREATE TABLE IF NOT EXISTS offline_mutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mutation_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
      table_name TEXT NOT NULL, -- 'notes', 'daily_prompts', 'prompt_responses'
      record_id TEXT NOT NULL, -- The ID of the record being mutated
      payload TEXT, -- JSON string of the record data
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Utility to record an offline mutation
export async function recordMutation(
  database: SQLite.SQLiteDatabase,
  mutation_type: 'INSERT' | 'UPDATE' | 'DELETE',
  table_name: string,
  record_id: string,
  payload: any
) {
  await database.runAsync(
    `INSERT INTO offline_mutations (mutation_type, table_name, record_id, payload) VALUES (?, ?, ?, ?)`,
    mutation_type,
    table_name,
    record_id,
    payload ? JSON.stringify(payload) : null
  );
}

// Utility to clear processed mutations
export async function clearMutation(database: SQLite.SQLiteDatabase, id: number) {
  await database.runAsync(`DELETE FROM offline_mutations WHERE id = ?`, id);
}

// Utility to get all pending mutations
export async function getPendingMutations(database: SQLite.SQLiteDatabase) {
  return await database.getAllAsync<any>(
    `SELECT * FROM offline_mutations ORDER BY created_at ASC`
  );
}

// Utility to wipe the database on sign out to prevent data bleed
export async function clearDatabase(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    DELETE FROM notes;
    DELETE FROM daily_prompts;
    DELETE FROM prompt_responses;
    DELETE FROM offline_mutations;
  `);
}
