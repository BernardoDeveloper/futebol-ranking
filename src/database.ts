// The shape of supabase/migrations/0001_init.sql as supabase-js sees it. Keep in step with the migration.

type Empty = { [_ in never]: never };

export interface Database {
  public: {
    Tables: {
      players: {
        Row: { id: string; name: string; email: string; is_admin: boolean; created_at: string };
        Insert: { id?: string; name: string; email: string; is_admin?: boolean; created_at?: string };
        Update: { id?: string; name?: string; email?: string; is_admin?: boolean; created_at?: string };
        Relationships: [];
      };
      ratings: {
        Row: { rater_id: string; rated_id: string; value: number; updated_at: string };
        Insert: { rater_id: string; rated_id: string; value: number; updated_at?: string };
        Update: { rater_id?: string; rated_id?: string; value?: number; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Empty;
    Functions: {
      ranking: {
        Args: Empty;
        Returns: { player_id: string; name: string; average: number | null; ratings_count: number }[];
      };
    };
    Enums: Empty;
    CompositeTypes: Empty;
  };
}
