export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MemberRole = 'caretaker' | 'family'
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say'
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown'
export type ScheduleFrequency = 'daily' | 'weekly' | 'custom'
export type MedicationLogStatus = 'unconfirmed' | 'taken' | 'skipped' | 'missed'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'
export type DeliveryStatus = 'processing' | 'sent' | 'failed' | 'skipped'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      elder_profiles: {
        Row: {
          id: string
          owner_user_id: string
          full_name: string
          date_of_birth: string
          gender: Gender | null
          blood_group: BloodGroup | null
          medical_conditions: string[]
          allergies: string[]
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          full_name: string
          date_of_birth: string
          gender?: Gender | null
          blood_group?: BloodGroup | null
          medical_conditions?: string[]
          allergies?: string[]
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          full_name?: string
          date_of_birth?: string
          gender?: Gender | null
          blood_group?: BloodGroup | null
          medical_conditions?: string[]
          allergies?: string[]
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'elder_profiles_owner_user_id_fkey'
            columns: ['owner_user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      care_circle_members: {
        Row: {
          id: string
          elder_profile_id: string
          member_user_id: string
          role: MemberRole
          can_view_medical_info: boolean
          can_manage_medications: boolean
          can_manage_appointments: boolean
          can_manage_members: boolean
          created_at: string
        }
        Insert: {
          id?: string
          elder_profile_id: string
          member_user_id: string
          role: MemberRole
          can_view_medical_info?: boolean
          can_manage_medications?: boolean
          can_manage_appointments?: boolean
          can_manage_members?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          elder_profile_id?: string
          member_user_id?: string
          role?: MemberRole
          can_view_medical_info?: boolean
          can_manage_medications?: boolean
          can_manage_appointments?: boolean
          can_manage_members?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'care_circle_members_elder_profile_id_fkey'
            columns: ['elder_profile_id']
            referencedRelation: 'elder_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'care_circle_members_member_user_id_fkey'
            columns: ['member_user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      care_invitations: {
        Row: {
          id: string
          elder_profile_id: string
          invited_email: string | null
          invitation_code_hash: string
          assigned_role: MemberRole
          expires_at: string
          accepted_at: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          elder_profile_id: string
          invited_email?: string | null
          invitation_code_hash: string
          assigned_role: MemberRole
          expires_at: string
          accepted_at?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          elder_profile_id?: string
          invited_email?: string | null
          invitation_code_hash?: string
          assigned_role?: MemberRole
          expires_at?: string
          accepted_at?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'care_invitations_elder_profile_id_fkey'
            columns: ['elder_profile_id']
            referencedRelation: 'elder_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'care_invitations_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      medications: {
        Row: {
          id: string
          elder_profile_id: string
          medication_name: string
          description: string | null
          dosage: string
          unit: string
          instructions: string | null
          start_date: string
          end_date: string | null
          prescribed_by: string | null
          created_by: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          elder_profile_id: string
          medication_name: string
          description?: string | null
          dosage: string
          unit: string
          instructions?: string | null
          start_date: string
          end_date?: string | null
          prescribed_by?: string | null
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          elder_profile_id?: string
          medication_name?: string
          description?: string | null
          dosage?: string
          unit?: string
          instructions?: string | null
          start_date?: string
          end_date?: string | null
          prescribed_by?: string | null
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'medications_elder_profile_id_fkey'
            columns: ['elder_profile_id']
            referencedRelation: 'elder_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'medications_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      medication_schedules: {
        Row: {
          id: string
          medication_id: string
          elder_profile_id: string
          scheduled_time: string
          frequency: ScheduleFrequency
          days_of_week: number[]
          timezone: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          medication_id: string
          elder_profile_id: string
          scheduled_time: string
          frequency: ScheduleFrequency
          days_of_week?: number[]
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          medication_id?: string
          elder_profile_id?: string
          scheduled_time?: string
          frequency?: ScheduleFrequency
          days_of_week?: number[]
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_schedule_medication_elder'
            columns: ['medication_id', 'elder_profile_id']
            referencedRelation: 'medications'
            referencedColumns: ['id', 'elder_profile_id']
          }
        ]
      }
      medication_logs: {
        Row: {
          id: string
          medication_id: string
          schedule_id: string
          elder_profile_id: string
          scheduled_for: string
          status: MedicationLogStatus
          recorded_by: string | null
          recorded_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          medication_id: string
          schedule_id: string
          elder_profile_id: string
          scheduled_for: string
          status: MedicationLogStatus
          recorded_by: string
          recorded_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          medication_id?: string
          schedule_id?: string
          elder_profile_id?: string
          scheduled_for?: string
          status?: MedicationLogStatus
          recorded_by?: string | null
          recorded_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_log_medication_elder'
            columns: ['medication_id', 'elder_profile_id']
            referencedRelation: 'medications'
            referencedColumns: ['id', 'elder_profile_id']
          },
          {
            foreignKeyName: 'fk_log_schedule_elder'
            columns: ['schedule_id', 'elder_profile_id']
            referencedRelation: 'medication_schedules'
            referencedColumns: ['id', 'elder_profile_id']
          },
          {
            foreignKeyName: 'medication_logs_recorded_by_fkey'
            columns: ['recorded_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          elder_profile_id: string
          doctor_name: string
          hospital_name: string | null
          appointment_date: string
          location: string | null
          reason: string | null
          notes: string | null
          status: AppointmentStatus
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          elder_profile_id: string
          doctor_name: string
          hospital_name?: string | null
          appointment_date: string
          location?: string | null
          reason?: string | null
          notes?: string | null
          status?: AppointmentStatus
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          elder_profile_id?: string
          doctor_name?: string
          hospital_name?: string | null
          appointment_date?: string
          location?: string | null
          reason?: string | null
          notes?: string | null
          status?: AppointmentStatus
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_elder_profile_id_fkey'
            columns: ['elder_profile_id']
            referencedRelation: 'elder_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      notification_preferences: {
        Row: {
          user_id: string
          medication_reminders: boolean
          missed_dose_alerts: boolean
          appointment_reminders: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          medication_reminders?: boolean
          missed_dose_alerts?: boolean
          appointment_reminders?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          medication_reminders?: boolean
          missed_dose_alerts?: boolean
          appointment_reminders?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          id: string
          event_key: string
          event_type: string
          recipient_user_id: string
          status: DeliveryStatus
          attempt_count: number
          provider_message_id: string | null
          last_error_code: string | null
          locked_at: string | null
          next_attempt_at: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_key: string
          event_type: string
          recipient_user_id: string
          status?: DeliveryStatus
          attempt_count?: number
          provider_message_id?: string | null
          last_error_code?: string | null
          locked_at?: string | null
          next_attempt_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_key?: string
          event_type?: string
          recipient_user_id?: string
          status?: DeliveryStatus
          attempt_count?: number
          provider_message_id?: string | null
          last_error_code?: string | null
          locked_at?: string | null
          next_attempt_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_elder_owner: {
        Args: {
          elder_id: string
        }
        Returns: boolean
      }
      is_care_circle_member: {
        Args: {
          elder_id: string
        }
        Returns: boolean
      }
      has_elder_permission: {
        Args: {
          elder_id: string
          permission_name: string
        }
        Returns: boolean
      }
      can_record_medication_log: {
        Args: {
          elder_id: string
        }
        Returns: boolean
      }
      shares_care_circle_with: {
        Args: {
          other_user_id: string
        }
        Returns: boolean
      }
      create_care_invitation: {
        Args: {
          p_elder_id: string
          p_invited_email?: string | null
          p_assigned_role?: MemberRole
          p_duration_hours?: number
        }
        Returns: Json
      }
      accept_care_invitation: {
        Args: {
          raw_code: string
        }
        Returns: Json
      }
      revoke_care_invitation: {
        Args: {
          invitation_id: string
        }
        Returns: boolean
      }
      claim_notification_event: {
        Args: {
          p_event_key: string
          p_event_type: string
          p_recipient_user_id: string
        }
        Returns: boolean
      }
      complete_notification_delivery: {
        Args: {
          p_event_key: string
          p_provider_message_id?: string | null
        }
        Returns: void
      }
      fail_notification_delivery: {
        Args: {
          p_event_key: string
          p_error_code: string
          p_retry_delay_seconds?: number
        }
        Returns: void
      }
      skip_notification_delivery: {
        Args: {
          p_event_key: string
          p_reason: string
        }
        Returns: void
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

// Convenient Model Aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ElderProfile = Database['public']['Tables']['elder_profiles']['Row']
export type CareCircleMember = Database['public']['Tables']['care_circle_members']['Row']
export type CareInvitation = Database['public']['Tables']['care_invitations']['Row']
export type Medication = Database['public']['Tables']['medications']['Row']
export type MedicationSchedule = Database['public']['Tables']['medication_schedules']['Row']
export type MedicationLog = Database['public']['Tables']['medication_logs']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']
