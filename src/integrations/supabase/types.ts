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
      alerts: {
        Row: {
          activa: boolean
          contexto: Json | null
          created_at: string
          descripcion: string
          estado: string
          fecha: string
          hora: string | null
          id: string
          nivel: Database["public"]["Enums"]["alert_nivel"]
          score: number
          tipo: string
        }
        Insert: {
          activa?: boolean
          contexto?: Json | null
          created_at?: string
          descripcion: string
          estado?: string
          fecha?: string
          hora?: string | null
          id?: string
          nivel?: Database["public"]["Enums"]["alert_nivel"]
          score?: number
          tipo: string
        }
        Update: {
          activa?: boolean
          contexto?: Json | null
          created_at?: string
          descripcion?: string
          estado?: string
          fecha?: string
          hora?: string | null
          id?: string
          nivel?: Database["public"]["Enums"]["alert_nivel"]
          score?: number
          tipo?: string
        }
        Relationships: []
      }
      cartera_resultados: {
        Row: {
          acierto: boolean
          acierto_segundo: boolean | null
          acierto_tercero: boolean | null
          cartera_id: string
          evaluated_at: string
          id: string
          numero_ganador: number
          numero_segundo: number | null
          numero_tercero: number | null
        }
        Insert: {
          acierto: boolean
          acierto_segundo?: boolean | null
          acierto_tercero?: boolean | null
          cartera_id: string
          evaluated_at?: string
          id?: string
          numero_ganador: number
          numero_segundo?: number | null
          numero_tercero?: number | null
        }
        Update: {
          acierto?: boolean
          acierto_segundo?: boolean | null
          acierto_tercero?: boolean | null
          cartera_id?: string
          evaluated_at?: string
          id?: string
          numero_ganador?: number
          numero_segundo?: number | null
          numero_tercero?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cartera_resultados_cartera_id_fkey"
            columns: ["cartera_id"]
            isOneToOne: true
            referencedRelation: "carteras"
            referencedColumns: ["id"]
          },
        ]
      }
      carteras: {
        Row: {
          contexto: Json
          created_at: string
          estrategia: string
          fecha: string
          hora: string
          id: string
          numeros: number[]
          scores: Json
        }
        Insert: {
          contexto?: Json
          created_at?: string
          estrategia?: string
          fecha: string
          hora: string
          id?: string
          numeros: number[]
          scores?: Json
        }
        Update: {
          contexto?: Json
          created_at?: string
          estrategia?: string
          fecha?: string
          hora?: string
          id?: string
          numeros?: number[]
          scores?: Json
        }
        Relationships: []
      }
      draws: {
        Row: {
          alto_bajo: string
          created_at: string
          cuadrante: string
          extra: Json | null
          fecha: string
          id: string
          movimiento: string | null
          numero: number
          observacion: string | null
          origen: Database["public"]["Enums"]["draw_origen"]
          par_impar: string
          patron_detectado: string | null
          sorteo_id: string
          subcuadrante: string | null
          updated_at: string
        }
        Insert: {
          alto_bajo: string
          created_at?: string
          cuadrante: string
          extra?: Json | null
          fecha: string
          id?: string
          movimiento?: string | null
          numero: number
          observacion?: string | null
          origen?: Database["public"]["Enums"]["draw_origen"]
          par_impar: string
          patron_detectado?: string | null
          sorteo_id: string
          subcuadrante?: string | null
          updated_at?: string
        }
        Update: {
          alto_bajo?: string
          created_at?: string
          cuadrante?: string
          extra?: Json | null
          fecha?: string
          id?: string
          movimiento?: string | null
          numero?: number
          observacion?: string | null
          origen?: Database["public"]["Enums"]["draw_origen"]
          par_impar?: string
          patron_detectado?: string | null
          sorteo_id?: string
          subcuadrante?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draws_sorteo_id_fkey"
            columns: ["sorteo_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          archivo: string
          created_at: string
          detalle_errores: Json | null
          errores: number
          estado: string
          id: string
          registros_duplicados: number
          registros_importados: number
        }
        Insert: {
          archivo: string
          created_at?: string
          detalle_errores?: Json | null
          errores?: number
          estado?: string
          id?: string
          registros_duplicados?: number
          registros_importados?: number
        }
        Update: {
          archivo?: string
          created_at?: string
          detalle_errores?: Json | null
          errores?: number
          estado?: string
          id?: string
          registros_duplicados?: number
          registros_importados?: number
        }
        Relationships: []
      }
      lotteries: {
        Row: {
          activa: boolean
          created_at: string
          descripcion: string | null
          horarios: Json | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          horarios?: Json | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          horarios?: Json | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      lottery_draws: {
        Row: {
          activa: boolean
          created_at: string
          hora: string
          id: string
          loteria_id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          hora: string
          id?: string
          loteria_id: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          hora?: string
          id?: string
          loteria_id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_draws_loteria_id_fkey"
            columns: ["loteria_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_stats: {
        Row: {
          dias_vencido: number | null
          frecuencia: number
          hora: string
          id: string
          numero: number
          periodo: number
          total_sorteos: number | null
          updated_at: string
        }
        Insert: {
          dias_vencido?: number | null
          frecuencia?: number
          hora: string
          id?: string
          numero: number
          periodo: number
          total_sorteos?: number | null
          updated_at?: string
        }
        Update: {
          dias_vencido?: number | null
          frecuencia?: number
          hora?: string
          id?: string
          numero?: number
          periodo?: number
          total_sorteos?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      lottery_stats_sync_runs: {
        Row: {
          by_slot: Json
          combinaciones: number
          created_at: string
          detalle: Json
          duration_ms: number
          errores: number
          id: string
          ok: boolean
          periodos_total: number
          slots_total: number
          triggered_by: string
          upserts: number
        }
        Insert: {
          by_slot?: Json
          combinaciones?: number
          created_at?: string
          detalle?: Json
          duration_ms?: number
          errores?: number
          id?: string
          ok?: boolean
          periodos_total?: number
          slots_total?: number
          triggered_by?: string
          upserts?: number
        }
        Update: {
          by_slot?: Json
          combinaciones?: number
          created_at?: string
          detalle?: Json
          duration_ms?: number
          errores?: number
          id?: string
          ok?: boolean
          periodos_total?: number
          slots_total?: number
          triggered_by?: string
          upserts?: number
        }
        Relationships: []
      }
      opportunity_alerts: {
        Row: {
          cartera_id: string
          created_at: string
          dismissed_at: string | null
          fecha: string
          gap: number
          hora: string
          id: string
          internal_score: number
          notified_at: string | null
          top_mean: number
        }
        Insert: {
          cartera_id: string
          created_at?: string
          dismissed_at?: string | null
          fecha: string
          gap?: number
          hora: string
          id?: string
          internal_score: number
          notified_at?: string | null
          top_mean?: number
        }
        Update: {
          cartera_id?: string
          created_at?: string
          dismissed_at?: string | null
          fecha?: string
          gap?: number
          hora?: string
          id?: string
          internal_score?: number
          notified_at?: string | null
          top_mean?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_alerts_cartera_id_fkey"
            columns: ["cartera_id"]
            isOneToOne: false
            referencedRelation: "carteras"
            referencedColumns: ["id"]
          },
        ]
      }
      patterns: {
        Row: {
          aciertos: number
          activa: boolean
          condiciones: Json
          created_at: string
          descripcion: string
          efectividad: number
          efectividad_mensual: Json
          estado: string
          hora: string | null
          id: string
          nombre: string
          ocurrencias: number
          resultado_esperado: string | null
          score_confianza: number | null
          source: string
          tipo: Database["public"]["Enums"]["rule_tipo"]
          ultima_deteccion: string | null
          updated_at: string
        }
        Insert: {
          aciertos?: number
          activa?: boolean
          condiciones?: Json
          created_at?: string
          descripcion: string
          efectividad?: number
          efectividad_mensual?: Json
          estado?: string
          hora?: string | null
          id?: string
          nombre: string
          ocurrencias?: number
          resultado_esperado?: string | null
          score_confianza?: number | null
          source?: string
          tipo?: Database["public"]["Enums"]["rule_tipo"]
          ultima_deteccion?: string | null
          updated_at?: string
        }
        Update: {
          aciertos?: number
          activa?: boolean
          condiciones?: Json
          created_at?: string
          descripcion?: string
          efectividad?: number
          efectividad_mensual?: Json
          estado?: string
          hora?: string | null
          id?: string
          nombre?: string
          ocurrencias?: number
          resultado_esperado?: string | null
          score_confianza?: number | null
          source?: string
          tipo?: Database["public"]["Enums"]["rule_tipo"]
          ultima_deteccion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          activa: boolean
          created_at: string
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rules: {
        Row: {
          aciertos: number
          activo: boolean
          condiciones: Json
          created_at: string
          descripcion: string | null
          efectividad: number
          id: string
          nombre: string
          ocurrencias: number
          resultado_esperado: string | null
          tipo: Database["public"]["Enums"]["rule_tipo"]
          updated_at: string
        }
        Insert: {
          aciertos?: number
          activo?: boolean
          condiciones?: Json
          created_at?: string
          descripcion?: string | null
          efectividad?: number
          id?: string
          nombre: string
          ocurrencias?: number
          resultado_esperado?: string | null
          tipo?: Database["public"]["Enums"]["rule_tipo"]
          updated_at?: string
        }
        Update: {
          aciertos?: number
          activo?: boolean
          condiciones?: Json
          created_at?: string
          descripcion?: string | null
          efectividad?: number
          id?: string
          nombre?: string
          ocurrencias?: number
          resultado_esperado?: string | null
          tipo?: Database["public"]["Enums"]["rule_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          clave: string
          created_at: string
          descripcion: string | null
          id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          clave: string
          created_at?: string
          descripcion?: string | null
          id?: string
          updated_at?: string
          valor: Json
        }
        Update: {
          clave?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          detalle: Json
          duplicadas: number
          errores: number
          id: string
          nuevas: number
          ok: boolean
          total_procesadas: number
        }
        Insert: {
          created_at?: string
          detalle?: Json
          duplicadas?: number
          errores?: number
          id?: string
          nuevas?: number
          ok?: boolean
          total_procesadas?: number
        }
        Update: {
          created_at?: string
          detalle?: Json
          duplicadas?: number
          errores?: number
          id?: string
          nuevas?: number
          ok?: boolean
          total_procesadas?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      classify_number: {
        Args: { _numero: number }
        Returns: {
          alto_bajo: string
          cuadrante: string
          par_impar: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_nivel: "info" | "warning" | "critical"
      app_role: "admin" | "user"
      draw_origen: "manual" | "scraper" | "excel"
      rule_tipo: "racha" | "compensacion" | "patron" | "bloqueo" | "otro"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_nivel: ["info", "warning", "critical"],
      app_role: ["admin", "user"],
      draw_origen: ["manual", "scraper", "excel"],
      rule_tipo: ["racha", "compensacion", "patron", "bloqueo", "otro"],
    },
  },
} as const
