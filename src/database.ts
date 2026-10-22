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
          status: 'pending' | 'paid' | 'expired';
          charge_id: string | null;
          br_code: string | null;
          qr_code: string | null;
          expires_at: string | null;
          created_at: string;
          paid_at: string | null;
        };
        // Written only by the Edge Functions, with the service role.
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
      manipulated_ranking: {
        Args: Empty;
        Returns: { player_id: string; name: string; average: number | null; manipulated: boolean }[];
      };
    };
    Enums: Empty;
    CompositeTypes: Empty;
  };
}
