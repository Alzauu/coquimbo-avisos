export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      categorias: {
        Row: {
          activa: boolean;
          codigo: string;
          icono: string | null;
          id: number;
          nombre: string;
          tipo: Database["public"]["Enums"]["tipo_categoria"];
        };
        Insert: {
          activa?: boolean;
          codigo: string;
          icono?: string | null;
          id?: number;
          nombre: string;
          tipo: Database["public"]["Enums"]["tipo_categoria"];
        };
        Update: {
          activa?: boolean;
          codigo?: string;
          icono?: string | null;
          id?: number;
          nombre?: string;
          tipo?: Database["public"]["Enums"]["tipo_categoria"];
        };
        Relationships: [];
      };
      comentarios: {
        Row: {
          contenido: string;
          creado_en: string;
          id: number;
          reporte_id: string;
          usuario_id: string | null;
        };
        Insert: {
          contenido: string;
          creado_en?: string;
          id?: number;
          reporte_id: string;
          usuario_id?: string | null;
        };
        Update: {
          contenido?: string;
          creado_en?: string;
          id?: number;
          reporte_id?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "comentarios_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "reportes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comentarios_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "v_reportes_publicos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comentarios_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comunas: {
        Row: {
          activa: boolean;
          codigo: string;
          id: number;
          limites: unknown;
          nombre: string;
          provincia_id: number;
        };
        Insert: {
          activa?: boolean;
          codigo: string;
          id: number;
          limites?: unknown;
          nombre: string;
          provincia_id: number;
        };
        Update: {
          activa?: boolean;
          codigo?: string;
          id?: number;
          limites?: unknown;
          nombre?: string;
          provincia_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "comunas_provincia_id_fkey";
            columns: ["provincia_id"];
            isOneToOne: false;
            referencedRelation: "provincias";
            referencedColumns: ["id"];
          },
        ];
      };
      dispositivos: {
        Row: {
          creado_en: string;
          id: number;
          plataforma: Database["public"]["Enums"]["plataforma_disp"];
          token_push: string;
          usuario_id: string;
        };
        Insert: {
          creado_en?: string;
          id?: number;
          plataforma: Database["public"]["Enums"]["plataforma_disp"];
          token_push: string;
          usuario_id: string;
        };
        Update: {
          creado_en?: string;
          id?: number;
          plataforma?: Database["public"]["Enums"]["plataforma_disp"];
          token_push?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dispositivos_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      entidades: {
        Row: {
          comuna_id: number | null;
          email_contacto: string | null;
          id: number;
          nombre: string;
          sitio_web: string | null;
          tipo: Database["public"]["Enums"]["tipo_entidad"];
        };
        Insert: {
          comuna_id?: number | null;
          email_contacto?: string | null;
          id?: number;
          nombre: string;
          sitio_web?: string | null;
          tipo: Database["public"]["Enums"]["tipo_entidad"];
        };
        Update: {
          comuna_id?: number | null;
          email_contacto?: string | null;
          id?: number;
          nombre?: string;
          sitio_web?: string | null;
          tipo?: Database["public"]["Enums"]["tipo_entidad"];
        };
        Relationships: [
          {
            foreignKeyName: "entidades_comuna_id_fkey";
            columns: ["comuna_id"];
            isOneToOne: false;
            referencedRelation: "comunas";
            referencedColumns: ["id"];
          },
        ];
      };
      notificaciones: {
        Row: {
          creado_en: string;
          cuerpo: string | null;
          enviada_en: string | null;
          id: number;
          leida: boolean;
          obra_id: string | null;
          reporte_id: string | null;
          tipo: Database["public"]["Enums"]["tipo_notificacion"];
          titulo: string;
          usuario_id: string;
        };
        Insert: {
          creado_en?: string;
          cuerpo?: string | null;
          enviada_en?: string | null;
          id?: number;
          leida?: boolean;
          obra_id?: string | null;
          reporte_id?: string | null;
          tipo: Database["public"]["Enums"]["tipo_notificacion"];
          titulo: string;
          usuario_id: string;
        };
        Update: {
          creado_en?: string;
          cuerpo?: string | null;
          enviada_en?: string | null;
          id?: number;
          leida?: boolean;
          obra_id?: string | null;
          reporte_id?: string | null;
          tipo?: Database["public"]["Enums"]["tipo_notificacion"];
          titulo?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notificaciones_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificaciones_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "v_obras_vigentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificaciones_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "reportes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificaciones_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "v_reportes_publicos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificaciones_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      obras: {
        Row: {
          actualizado_en: string;
          afecta_transito: boolean;
          categoria_id: number;
          comuna_id: number;
          creado_en: string;
          creado_por: string | null;
          descripcion: string | null;
          direccion_referencia: string | null;
          entidad_id: number | null;
          estado: Database["public"]["Enums"]["estado_obra"];
          fecha_fin: string | null;
          fecha_inicio: string;
          fuente_url: string | null;
          id: string;
          titulo: string;
          ubicacion: unknown;
        };
        Insert: {
          actualizado_en?: string;
          afecta_transito?: boolean;
          categoria_id: number;
          comuna_id: number;
          creado_en?: string;
          creado_por?: string | null;
          descripcion?: string | null;
          direccion_referencia?: string | null;
          entidad_id?: number | null;
          estado?: Database["public"]["Enums"]["estado_obra"];
          fecha_fin?: string | null;
          fecha_inicio: string;
          fuente_url?: string | null;
          id?: string;
          titulo: string;
          ubicacion: unknown;
        };
        Update: {
          actualizado_en?: string;
          afecta_transito?: boolean;
          categoria_id?: number;
          comuna_id?: number;
          creado_en?: string;
          creado_por?: string | null;
          descripcion?: string | null;
          direccion_referencia?: string | null;
          entidad_id?: number | null;
          estado?: Database["public"]["Enums"]["estado_obra"];
          fecha_fin?: string | null;
          fecha_inicio?: string;
          fuente_url?: string | null;
          id?: string;
          titulo?: string;
          ubicacion?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: "obras_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obras_comuna_id_fkey";
            columns: ["comuna_id"];
            isOneToOne: false;
            referencedRelation: "comunas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obras_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obras_entidad_id_fkey";
            columns: ["entidad_id"];
            isOneToOne: false;
            referencedRelation: "entidades";
            referencedColumns: ["id"];
          },
        ];
      };
      perfiles: {
        Row: {
          actualizado_en: string;
          creado_en: string;
          id: string;
          nombre_visible: string | null;
          rol: Database["public"]["Enums"]["rol_usuario"];
        };
        Insert: {
          actualizado_en?: string;
          creado_en?: string;
          id: string;
          nombre_visible?: string | null;
          rol?: Database["public"]["Enums"]["rol_usuario"];
        };
        Update: {
          actualizado_en?: string;
          creado_en?: string;
          id?: string;
          nombre_visible?: string | null;
          rol?: Database["public"]["Enums"]["rol_usuario"];
        };
        Relationships: [];
      };
      provincias: {
        Row: {
          codigo: string;
          id: number;
          nombre: string;
          region_id: number;
        };
        Insert: {
          codigo: string;
          id: number;
          nombre: string;
          region_id: number;
        };
        Update: {
          codigo?: string;
          id?: number;
          nombre?: string;
          region_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "provincias_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regiones";
            referencedColumns: ["id"];
          },
        ];
      };
      regiones: {
        Row: {
          activa: boolean;
          codigo: string;
          id: number;
          nombre: string;
        };
        Insert: {
          activa?: boolean;
          codigo: string;
          id: number;
          nombre: string;
        };
        Update: {
          activa?: boolean;
          codigo?: string;
          id?: number;
          nombre?: string;
        };
        Relationships: [];
      };
      reporte_apoyos: {
        Row: {
          creado_en: string;
          reporte_id: string;
          usuario_id: string;
        };
        Insert: {
          creado_en?: string;
          reporte_id: string;
          usuario_id: string;
        };
        Update: {
          creado_en?: string;
          reporte_id?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reporte_apoyos_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "reportes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reporte_apoyos_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "v_reportes_publicos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reporte_apoyos_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reporte_fotos: {
        Row: {
          creado_en: string;
          id: number;
          orden: number;
          reporte_id: string;
          url: string;
        };
        Insert: {
          creado_en?: string;
          id?: number;
          orden?: number;
          reporte_id: string;
          url: string;
        };
        Update: {
          creado_en?: string;
          id?: number;
          orden?: number;
          reporte_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reporte_fotos_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "reportes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reporte_fotos_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "v_reportes_publicos";
            referencedColumns: ["id"];
          },
        ];
      };
      reporte_historial: {
        Row: {
          cambiado_por: string | null;
          creado_en: string;
          estado_anterior: Database["public"]["Enums"]["estado_reporte"] | null;
          estado_nuevo: Database["public"]["Enums"]["estado_reporte"];
          id: number;
          nota: string | null;
          reporte_id: string;
        };
        Insert: {
          cambiado_por?: string | null;
          creado_en?: string;
          estado_anterior?:
            Database["public"]["Enums"]["estado_reporte"] | null;
          estado_nuevo: Database["public"]["Enums"]["estado_reporte"];
          id?: number;
          nota?: string | null;
          reporte_id: string;
        };
        Update: {
          cambiado_por?: string | null;
          creado_en?: string;
          estado_anterior?:
            Database["public"]["Enums"]["estado_reporte"] | null;
          estado_nuevo?: Database["public"]["Enums"]["estado_reporte"];
          id?: number;
          nota?: string | null;
          reporte_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reporte_historial_cambiado_por_fkey";
            columns: ["cambiado_por"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reporte_historial_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "reportes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reporte_historial_reporte_id_fkey";
            columns: ["reporte_id"];
            isOneToOne: false;
            referencedRelation: "v_reportes_publicos";
            referencedColumns: ["id"];
          },
        ];
      };
      reportes: {
        Row: {
          actualizado_en: string;
          categoria_id: number;
          comuna_id: number;
          creado_en: string;
          descripcion: string | null;
          direccion_referencia: string | null;
          entidad_asignada_id: number | null;
          es_anonimo: boolean;
          estado: Database["public"]["Enums"]["estado_reporte"];
          id: string;
          moderacion: Database["public"]["Enums"]["estado_moderacion"];
          resuelto_en: string | null;
          titulo: string;
          ubicacion: unknown;
          usuario_id: string | null;
        };
        Insert: {
          actualizado_en?: string;
          categoria_id: number;
          comuna_id: number;
          creado_en?: string;
          descripcion?: string | null;
          direccion_referencia?: string | null;
          entidad_asignada_id?: number | null;
          es_anonimo?: boolean;
          estado?: Database["public"]["Enums"]["estado_reporte"];
          id?: string;
          moderacion?: Database["public"]["Enums"]["estado_moderacion"];
          resuelto_en?: string | null;
          titulo: string;
          ubicacion: unknown;
          usuario_id?: string | null;
        };
        Update: {
          actualizado_en?: string;
          categoria_id?: number;
          comuna_id?: number;
          creado_en?: string;
          descripcion?: string | null;
          direccion_referencia?: string | null;
          entidad_asignada_id?: number | null;
          es_anonimo?: boolean;
          estado?: Database["public"]["Enums"]["estado_reporte"];
          id?: string;
          moderacion?: Database["public"]["Enums"]["estado_moderacion"];
          resuelto_en?: string | null;
          titulo?: string;
          ubicacion?: unknown;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reportes_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reportes_comuna_id_fkey";
            columns: ["comuna_id"];
            isOneToOne: false;
            referencedRelation: "comunas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reportes_entidad_asignada_id_fkey";
            columns: ["entidad_asignada_id"];
            isOneToOne: false;
            referencedRelation: "entidades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reportes_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      suscripciones: {
        Row: {
          categoria_id: number | null;
          comuna_id: number;
          creado_en: string;
          id: number;
          usuario_id: string;
        };
        Insert: {
          categoria_id?: number | null;
          comuna_id: number;
          creado_en?: string;
          id?: number;
          usuario_id: string;
        };
        Update: {
          categoria_id?: number | null;
          comuna_id?: number;
          creado_en?: string;
          id?: number;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suscripciones_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suscripciones_comuna_id_fkey";
            columns: ["comuna_id"];
            isOneToOne: false;
            referencedRelation: "comunas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suscripciones_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_obras_vigentes: {
        Row: {
          actualizado_en: string | null;
          afecta_transito: boolean | null;
          categoria_id: number | null;
          comuna_id: number | null;
          creado_en: string | null;
          creado_por: string | null;
          descripcion: string | null;
          direccion_referencia: string | null;
          entidad_id: number | null;
          estado: Database["public"]["Enums"]["estado_obra"] | null;
          fecha_fin: string | null;
          fecha_inicio: string | null;
          fuente_url: string | null;
          id: string | null;
          titulo: string | null;
          ubicacion: unknown;
        };
        Insert: {
          actualizado_en?: string | null;
          afecta_transito?: boolean | null;
          categoria_id?: number | null;
          comuna_id?: number | null;
          creado_en?: string | null;
          creado_por?: string | null;
          descripcion?: string | null;
          direccion_referencia?: string | null;
          entidad_id?: number | null;
          estado?: Database["public"]["Enums"]["estado_obra"] | null;
          fecha_fin?: string | null;
          fecha_inicio?: string | null;
          fuente_url?: string | null;
          id?: string | null;
          titulo?: string | null;
          ubicacion?: unknown;
        };
        Update: {
          actualizado_en?: string | null;
          afecta_transito?: boolean | null;
          categoria_id?: number | null;
          comuna_id?: number | null;
          creado_en?: string | null;
          creado_por?: string | null;
          descripcion?: string | null;
          direccion_referencia?: string | null;
          entidad_id?: number | null;
          estado?: Database["public"]["Enums"]["estado_obra"] | null;
          fecha_fin?: string | null;
          fecha_inicio?: string | null;
          fuente_url?: string | null;
          id?: string | null;
          titulo?: string | null;
          ubicacion?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: "obras_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obras_comuna_id_fkey";
            columns: ["comuna_id"];
            isOneToOne: false;
            referencedRelation: "comunas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obras_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obras_entidad_id_fkey";
            columns: ["entidad_id"];
            isOneToOne: false;
            referencedRelation: "entidades";
            referencedColumns: ["id"];
          },
        ];
      };
      v_reportes_publicos: {
        Row: {
          categoria_id: number | null;
          comuna_id: number | null;
          creado_en: string | null;
          descripcion: string | null;
          direccion_referencia: string | null;
          estado: Database["public"]["Enums"]["estado_reporte"] | null;
          id: string | null;
          latitud: number | null;
          longitud: number | null;
          resuelto_en: string | null;
          titulo: string | null;
          ubicacion: unknown;
        };
        Insert: {
          categoria_id?: number | null;
          comuna_id?: number | null;
          creado_en?: string | null;
          descripcion?: string | null;
          direccion_referencia?: string | null;
          estado?: Database["public"]["Enums"]["estado_reporte"] | null;
          id?: string | null;
          latitud?: never;
          longitud?: never;
          resuelto_en?: string | null;
          titulo?: string | null;
          ubicacion?: unknown;
        };
        Update: {
          categoria_id?: number | null;
          comuna_id?: number | null;
          creado_en?: string | null;
          descripcion?: string | null;
          direccion_referencia?: string | null;
          estado?: Database["public"]["Enums"]["estado_reporte"] | null;
          id?: string | null;
          latitud?: never;
          longitud?: never;
          resuelto_en?: string | null;
          titulo?: string | null;
          ubicacion?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: "reportes_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reportes_comuna_id_fkey";
            columns: ["comuna_id"];
            isOneToOne: false;
            referencedRelation: "comunas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      reportes_en_zona: {
        Args: {
          categorias?: number[];
          estados?: Database["public"]["Enums"]["estado_reporte"][];
          este: number;
          norte: number;
          oeste: number;
          sur: number;
        };
        Returns: {
          categoria_id: number;
          creado_en: string;
          descripcion: string;
          direccion_referencia: string;
          estado: Database["public"]["Enums"]["estado_reporte"];
          id: string;
          latitud: number;
          longitud: number;
          resuelto_en: string;
          titulo: string;
        }[];
      };
    };
    Enums: {
      estado_moderacion: "pendiente" | "aprobado" | "oculto";
      estado_obra: "programada" | "en_curso" | "finalizada" | "cancelada";
      estado_reporte:
        "recibido" | "en_revision" | "derivado" | "resuelto" | "rechazado";
      plataforma_disp: "android" | "ios" | "web";
      rol_usuario: "ciudadano" | "moderador" | "admin";
      tipo_categoria: "reporte" | "obra";
      tipo_entidad:
        | "municipalidad"
        | "gobierno_regional"
        | "ministerio"
        | "sanitaria"
        | "electrica"
        | "otra";
      tipo_notificacion:
        | "nuevo_reporte_zona"
        | "cambio_estado_reporte"
        | "nueva_obra_zona"
        | "cambio_estado_obra"
        | "comentario";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      estado_moderacion: ["pendiente", "aprobado", "oculto"],
      estado_obra: ["programada", "en_curso", "finalizada", "cancelada"],
      estado_reporte: [
        "recibido",
        "en_revision",
        "derivado",
        "resuelto",
        "rechazado",
      ],
      plataforma_disp: ["android", "ios", "web"],
      rol_usuario: ["ciudadano", "moderador", "admin"],
      tipo_categoria: ["reporte", "obra"],
      tipo_entidad: [
        "municipalidad",
        "gobierno_regional",
        "ministerio",
        "sanitaria",
        "electrica",
        "otra",
      ],
      tipo_notificacion: [
        "nuevo_reporte_zona",
        "cambio_estado_reporte",
        "nueva_obra_zona",
        "cambio_estado_obra",
        "comentario",
      ],
    },
  },
} as const;
