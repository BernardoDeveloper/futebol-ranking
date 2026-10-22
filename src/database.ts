// The shape of supabase/migrations/ as supabase-js sees it. Keep in step with the migration.

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
      manipulations: {
        Row: {
          id: string;
          player_id: string;
          status: 'pending' | 'paid' | 'rejected';
          created_at: string;
          paid_at: string | null;
          decided_by: string | null;
        };
        // Written only through start_manipulation(), confirm_manipulation() and reject_manipulation().
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Empty;
    Functions: {
      ranking: {
        Args: Empty;
        Returns: { player_id: string; name: string; average: number | null; ratings_count: number }[];
      };
      start_manipulation: {
        Args: Empty;
        Returns: Database['public']['Tables']['manipulations']['Row'];
      };
      confirm_manipulation: {
        Args: { manipulation_id: string };
        Returns: undefined;
      };
      reject_manipulation: {
        Args: { manipulation_id: string };
        Returns: undefined;
      };
      pending_manipulations: {
        Args: Empty;
        Returns: { id: string; name: string; created_at: string }[];
      };
      manipulated_ranking: {
        Args: Empty;
        Returns: { player_id: string; name: string; average: number | null; manipulated: boolean }[];
      };
    };
    Enums: Empty;
    CompositeTypes: Empty;
  };
}
