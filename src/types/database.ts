export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      date_days: {
        Row: {
          created_at: string
          date: string
          date_id: string
          day_number: number
          id: string
          note: string | null
          planning_start_time: string
          space_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          date_id: string
          day_number: number
          id?: string
          note?: string | null
          planning_start_time?: string
          space_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          date_id?: string
          day_number?: number
          id?: string
          note?: string | null
          planning_start_time?: string
          space_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_days_date_space_fkey"
            columns: ["date_id", "space_id"]
            isOneToOne: false
            referencedRelation: "dates"
            referencedColumns: ["id", "space_id"]
          },
        ]
      }
      date_itinerary_items: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          date_day_id: string
          date_id: string
          description: string | null
          duration_minutes: number
          fixed_start_time: string | null
          google_maps_url: string | null
          id: string
          item_type: string
          latitude: number | null
          location_name: string | null
          longitude: number | null
          place_id: string | null
          restaurant_id: string | null
          sort_order: number
          space_id: string
          timing_type: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          date_day_id: string
          date_id: string
          description?: string | null
          duration_minutes?: number
          fixed_start_time?: string | null
          google_maps_url?: string | null
          id?: string
          item_type?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          place_id?: string | null
          restaurant_id?: string | null
          sort_order?: number
          space_id: string
          timing_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          date_day_id?: string
          date_id?: string
          description?: string | null
          duration_minutes?: number
          fixed_start_time?: string | null
          google_maps_url?: string | null
          id?: string
          item_type?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          place_id?: string | null
          restaurant_id?: string | null
          sort_order?: number
          space_id?: string
          timing_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_itinerary_items_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_itinerary_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_day_date_space_fkey"
            columns: ["date_day_id", "date_id", "space_id"]
            isOneToOne: false
            referencedRelation: "date_days"
            referencedColumns: ["id", "date_id", "space_id"]
          },
        ]
      }
      date_participants: {
        Row: {
          created_at: string
          date_id: string
          id: string
          responded_at: string | null
          role: string
          space_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_id: string
          id?: string
          responded_at?: string | null
          role: string
          space_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_id?: string
          id?: string
          responded_at?: string | null
          role?: string
          space_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_participants_date_space_fkey"
            columns: ["date_id", "space_id"]
            isOneToOne: false
            referencedRelation: "dates"
            referencedColumns: ["id", "space_id"]
          },
        ]
      }
      dates: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          kind: string
          organizer_id: string
          space_id: string
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          kind?: string
          organizer_id: string
          space_id: string
          start_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          kind?: string
          organizer_id?: string
          space_id?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dates_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          location: string | null
          note: string | null
          space_id: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          note?: string | null
          space_id: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          note?: string | null
          space_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          entry_date: string
          id: string
          published_at: string | null
          space_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          entry_date: string
          id?: string
          published_at?: string | null
          space_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          published_at?: string | null
          space_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          alt_text: string | null
          created_at: string
          file_name: string
          file_size: number | null
          height: number | null
          id: string
          mime_type: string | null
          space_id: string
          storage_path: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          space_id: string
          storage_path: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          space_id?: string
          storage_path?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          location_name: string | null
          memory_date: string
          space_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_name?: string | null
          memory_date: string
          space_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_name?: string | null
          memory_date?: string
          space_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_media: {
        Row: {
          caption: string | null
          created_at: string
          media_id: string
          memory_id: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          media_id: string
          memory_id: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          media_id?: string
          memory_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "memory_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_media_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          note: string | null
          space_id: string
          status: string
          updated_at: string
          visited_on: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          note?: string | null
          space_id: string
          status?: string
          updated_at?: string
          visited_on?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          note?: string | null
          space_id?: string
          status?: string
          updated_at?: string
          visited_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_visits: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          restaurant_id: string
          selected_by_picker: boolean
          space_id: string
          visited_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          restaurant_id: string
          selected_by_picker?: boolean
          space_id: string
          visited_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          restaurant_id?: string
          selected_by_picker?: boolean
          space_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_visits_restaurant_space_fkey"
            columns: ["restaurant_id", "space_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id", "space_id"]
          },
          {
            foreignKeyName: "restaurant_visits_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          area: string | null
          contexts: string[]
          created_at: string
          created_by: string | null
          cuisines: string[]
          google_maps_url: string | null
          google_place_id: string | null
          id: string
          is_hidden: boolean
          latitude: number | null
          longitude: number | null
          name: string
          note: string | null
          price_level: number | null
          source: string
          source_key: string | null
          space_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          contexts?: string[]
          created_at?: string
          created_by?: string | null
          cuisines?: string[]
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          is_hidden?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          note?: string | null
          price_level?: number | null
          source?: string
          source_key?: string | null
          space_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          contexts?: string[]
          created_at?: string
          created_by?: string | null
          cuisines?: string[]
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          is_hidden?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          note?: string | null
          price_level?: number | null
          source?: string
          source_key?: string | null
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          joined_at: string
          role: string
          space_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          space_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_initial_space: {
        Args: { space_name: string; space_slug: string }
        Returns: string
      }
      create_date_invitation: {
        Args: {
          p_description: string
          p_end_date: string
          p_invitee_id: string
          p_kind: string
          p_space_id: string
          p_start_date: string
          p_title: string
        }
        Returns: string
      }
      reorder_date_itinerary: {
        Args: { p_date_day_id: string; p_item_ids: string[] }
        Returns: undefined
      }
      respond_to_date_invitation: {
        Args: { p_date_id: string; p_response: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
