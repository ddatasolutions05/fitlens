
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activity_records": {
                  Row: {
                    "created_at": string,"duration_min": number | null,"end_at": string | null,"external_id": string,"id": string,"intensity": string | null,"kcal_estimate": number | null,"kind": string,"local_date": string,"met": number | null,"note": string | null,"source": string,"start_at": string,"steps": number | null,"tz": string,"updated_at": string,"user_id": string,"workout_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_min"?: number | null,"end_at"?: string | null,"external_id"?: string,"id"?: string,"intensity"?: string | null,"kcal_estimate"?: number | null,"kind": string,"local_date": string,"met"?: number | null,"note"?: string | null,"source"?: string,"start_at"?: string,"steps"?: number | null,"tz": string,"updated_at"?: string,"user_id": string,"workout_type"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"duration_min"?: number | null,"end_at"?: string | null,"external_id"?: string,"id"?: string,"intensity"?: string | null,"kcal_estimate"?: number | null,"kind"?: string,"local_date"?: string,"met"?: number | null,"note"?: string | null,"source"?: string,"start_at"?: string,"steps"?: number | null,"tz"?: string,"updated_at"?: string,"user_id"?: string,"workout_type"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage": {
                  Row: {
                    "analyses": number,"coach_calls": number,"est_cost_usd": number,"label_reads": number,"local_date": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "analyses"?: number,"coach_calls"?: number,"est_cost_usd"?: number,"label_reads"?: number,"local_date": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "analyses"?: number,"coach_calls"?: number,"est_cost_usd"?: number,"label_reads"?: number,"local_date"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"client_events": {
                  Row: {
                    "app_version": string | null,"created_at": string,"extra": Json | null,"id": string,"kind": string,"message": string,"platform": string | null,"route": string | null,"scope": string,"stack": string | null,"user_agent": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "app_version"?: string | null,"created_at"?: string,"extra"?: Json | null,"id"?: string,"kind"?: string,"message": string,"platform"?: string | null,"route"?: string | null,"scope": string,"stack"?: string | null,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "app_version"?: string | null,"created_at"?: string,"extra"?: Json | null,"id"?: string,"kind"?: string,"message"?: string,"platform"?: string | null,"route"?: string | null,"scope"?: string,"stack"?: string | null,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"day_status": {
                  Row: {
                    "local_date": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "local_date": string,"status": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "local_date"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"food_servings": {
                  Row: {
                    "created_at": string,"food_id": string,"grams": number,"id": string,"label": string,"owner_user_id": string | null,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food_id": string,"grams": number,"id"?: string,"label": string,"owner_user_id"?: string | null,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string,"grams"?: number,"id"?: string,"label"?: string,"owner_user_id"?: string | null,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "food_servings_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"foods": {
                  Row: {
                    "attribution": string | null,"barcode": string | null,"brand": string | null,"carbs_g": number | null,"created_at": string,"default_serving_g": number | null,"fat_g": number | null,"fibre_g": number | null,"id": string,"kcal": number | null,"name": string,"owner_user_id": string | null,"protein_g": number | null,"sat_fat_g": number | null,"search_tsv": unknown,"sodium_mg": number | null,"source": string,"source_ref": string | null,"updated_at": string,"variant_label": string | null,"variant_of": string | null,"verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "attribution"?: string | null,"barcode"?: string | null,"brand"?: string | null,"carbs_g"?: number | null,"created_at"?: string,"default_serving_g"?: number | null,"fat_g"?: number | null,"fibre_g"?: number | null,"id"?: string,"kcal"?: number | null,"name": string,"owner_user_id"?: string | null,"protein_g"?: number | null,"sat_fat_g"?: number | null,"search_tsv"?: never,"sodium_mg"?: number | null,"source": string,"source_ref"?: string | null,"updated_at"?: string,"variant_label"?: string | null,"variant_of"?: string | null,"verified"?: boolean
                  }
                  Update: {
                    "attribution"?: string | null,"barcode"?: string | null,"brand"?: string | null,"carbs_g"?: number | null,"created_at"?: string,"default_serving_g"?: number | null,"fat_g"?: number | null,"fibre_g"?: number | null,"id"?: string,"kcal"?: number | null,"name"?: string,"owner_user_id"?: string | null,"protein_g"?: number | null,"sat_fat_g"?: number | null,"search_tsv"?: never,"sodium_mg"?: number | null,"source"?: string,"source_ref"?: string | null,"updated_at"?: string,"variant_label"?: string | null,"variant_of"?: string | null,"verified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "foods_variant_of_fkey"
      columns: ["variant_of"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"goal_versions": {
                  Row: {
                    "activity_level": string,"activity_mode": string,"calorie_target": number | null,"carbs_g": number | null,"created_at": string,"effective_from": string,"fat_g": number | null,"fibre_g": number | null,"goal_type": string,"id": string,"inputs": NonNullable<Json>,"pace": number | null,"protein_g": number | null,"rationale": string | null,"source": string,"step_goal": number | null,"user_id": string,"water_ml": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_level"?: string,"activity_mode"?: string,"calorie_target"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"effective_from": string,"fat_g"?: number | null,"fibre_g"?: number | null,"goal_type": string,"id"?: string,"inputs"?: NonNullable<Json>,"pace"?: number | null,"protein_g"?: number | null,"rationale"?: string | null,"source": string,"step_goal"?: number | null,"user_id": string,"water_ml"?: number | null
                  }
                  Update: {
                    "activity_level"?: string,"activity_mode"?: string,"calorie_target"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"effective_from"?: string,"fat_g"?: number | null,"fibre_g"?: number | null,"goal_type"?: string,"id"?: string,"inputs"?: NonNullable<Json>,"pace"?: number | null,"protein_g"?: number | null,"rationale"?: string | null,"source"?: string,"step_goal"?: number | null,"user_id"?: string,"water_ml"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"integration_connections": {
                  Row: {
                    "created_at": string,"id": string,"last_error": string | null,"last_sync_at": string | null,"priority": number,"provider": string,"scopes": (string)[],"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_error"?: string | null,"last_sync_at"?: string | null,"priority"?: number,"provider": string,"scopes"?: (string)[],"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_error"?: string | null,"last_sync_at"?: string | null,"priority"?: number,"provider"?: string,"scopes"?: (string)[],"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_items": {
                  Row: {
                    "assumptions": NonNullable<Json>,"carbs_g": number | null,"confidence": string | null,"created_at": string,"fat_g": number | null,"fibre_g": number | null,"food_id": string | null,"fraction_eaten": number,"grams": number,"id": string,"kcal": number | null,"kcal_high": number | null,"kcal_low": number | null,"meal_id": string,"name_snapshot": string,"per100_carbs_g": number | null,"per100_fat_g": number | null,"per100_fibre_g": number | null,"per100_kcal": number | null,"per100_protein_g": number | null,"per100_sat_fat_g": number | null,"per100_sodium_mg": number | null,"protein_g": number | null,"provenance": string,"sat_fat_g": number | null,"serving_label": string | null,"sodium_mg": number | null,"sort_order": number,"source_name": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assumptions"?: NonNullable<Json>,"carbs_g"?: number | null,"confidence"?: string | null,"created_at"?: string,"fat_g"?: number | null,"fibre_g"?: number | null,"food_id"?: string | null,"fraction_eaten"?: number,"grams": number,"id"?: string,"kcal"?: number | null,"kcal_high"?: number | null,"kcal_low"?: number | null,"meal_id": string,"name_snapshot": string,"per100_carbs_g"?: number | null,"per100_fat_g"?: number | null,"per100_fibre_g"?: number | null,"per100_kcal"?: number | null,"per100_protein_g"?: number | null,"per100_sat_fat_g"?: number | null,"per100_sodium_mg"?: number | null,"protein_g"?: number | null,"provenance": string,"sat_fat_g"?: number | null,"serving_label"?: string | null,"sodium_mg"?: number | null,"sort_order"?: number,"source_name"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "assumptions"?: NonNullable<Json>,"carbs_g"?: number | null,"confidence"?: string | null,"created_at"?: string,"fat_g"?: number | null,"fibre_g"?: number | null,"food_id"?: string | null,"fraction_eaten"?: number,"grams"?: number,"id"?: string,"kcal"?: number | null,"kcal_high"?: number | null,"kcal_low"?: number | null,"meal_id"?: string,"name_snapshot"?: string,"per100_carbs_g"?: number | null,"per100_fat_g"?: number | null,"per100_fibre_g"?: number | null,"per100_kcal"?: number | null,"per100_protein_g"?: number | null,"per100_sat_fat_g"?: number | null,"per100_sodium_mg"?: number | null,"protein_g"?: number | null,"provenance"?: string,"sat_fat_g"?: number | null,"serving_label"?: string | null,"sodium_mg"?: number | null,"sort_order"?: number,"source_name"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_items_meal_id_fkey"
      columns: ["meal_id"]
isOneToOne: false
      referencedRelation: "meals"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_photos": {
                  Row: {
                    "bytes": number | null,"created_at": string,"height": number | null,"id": string,"meal_id": string,"sort_order": number,"storage_path": string,"user_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes"?: number | null,"created_at"?: string,"height"?: number | null,"id"?: string,"meal_id": string,"sort_order"?: number,"storage_path": string,"user_id": string,"width"?: number | null
                  }
                  Update: {
                    "bytes"?: number | null,"created_at"?: string,"height"?: number | null,"id"?: string,"meal_id"?: string,"sort_order"?: number,"storage_path"?: string,"user_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_photos_meal_id_fkey"
      columns: ["meal_id"]
isOneToOne: false
      referencedRelation: "meals"
      referencedColumns: ["id"]
    }
                  ]
                },"meals": {
                  Row: {
                    "confirmed_at": string | null,"created_at": string,"eaten_at": string,"id": string,"idempotency_key": string,"local_date": string,"meal_type": string,"notes": string | null,"source": string,"status": string,"title": string | null,"tz": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string | null,"created_at"?: string,"eaten_at"?: string,"id"?: string,"idempotency_key": string,"local_date": string,"meal_type"?: string,"notes"?: string | null,"source": string,"status"?: string,"title"?: string | null,"tz": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "confirmed_at"?: string | null,"created_at"?: string,"eaten_at"?: string,"id"?: string,"idempotency_key"?: string,"local_date"?: string,"meal_type"?: string,"notes"?: string | null,"source"?: string,"status"?: string,"title"?: string | null,"tz"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"photo_analyses": {
                  Row: {
                    "created_at": string,"error_code": string | null,"error_detail": string | null,"est_cost_usd": number | null,"finished_at": string | null,"id": string,"input_tokens": number | null,"meal_id": string,"model": string | null,"output_tokens": number | null,"prompt_version": string | null,"provider": string | null,"started_at": string | null,"status": string,"user_id": string,"validated_response": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_code"?: string | null,"error_detail"?: string | null,"est_cost_usd"?: number | null,"finished_at"?: string | null,"id"?: string,"input_tokens"?: number | null,"meal_id": string,"model"?: string | null,"output_tokens"?: number | null,"prompt_version"?: string | null,"provider"?: string | null,"started_at"?: string | null,"status"?: string,"user_id": string,"validated_response"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"error_code"?: string | null,"error_detail"?: string | null,"est_cost_usd"?: number | null,"finished_at"?: string | null,"id"?: string,"input_tokens"?: number | null,"meal_id"?: string,"model"?: string | null,"output_tokens"?: number | null,"prompt_version"?: string | null,"provider"?: string | null,"started_at"?: string | null,"status"?: string,"user_id"?: string,"validated_response"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "photo_analyses_meal_id_fkey"
      columns: ["meal_id"]
isOneToOne: false
      referencedRelation: "meals"
      referencedColumns: ["id"]
    }
                  ]
                },"preferences": {
                  Row: {
                    "ai_consent_version": string | null,"ai_photo_consent_at": string | null,"allergies": (string)[],"avoid_foods": (string)[],"created_at": string,"cuisines": (string)[],"diet_pattern": string | null,"reduced_motion": boolean,"updated_at": string,"user_id": string,"workout_days_per_week": number | null,"workout_minutes": number | null,"workout_level": string | null,"workout_focus": string | null,"workout_equipment": string[],"workout_plan_seed": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_consent_version"?: string | null,"ai_photo_consent_at"?: string | null,"allergies"?: (string)[],"avoid_foods"?: (string)[],"created_at"?: string,"cuisines"?: (string)[],"diet_pattern"?: string | null,"reduced_motion"?: boolean,"updated_at"?: string,"user_id": string,"workout_days_per_week"?: number | null,"workout_minutes"?: number | null,"workout_level"?: string | null,"workout_focus"?: string | null,"workout_equipment"?: string[],"workout_plan_seed"?: number
                  }
                  Update: {
                    "ai_consent_version"?: string | null,"ai_photo_consent_at"?: string | null,"allergies"?: (string)[],"avoid_foods"?: (string)[],"created_at"?: string,"cuisines"?: (string)[],"diet_pattern"?: string | null,"reduced_motion"?: boolean,"updated_at"?: string,"user_id"?: string,"workout_days_per_week"?: number | null,"workout_minutes"?: number | null,"workout_level"?: string | null,"workout_focus"?: string | null,"workout_equipment"?: string[],"workout_plan_seed"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "birth_date": string | null,"created_at": string,"display_name": string | null,"goal_weight_kg": number | null,"height_cm": number | null,"hide_numbers": boolean,"mode": string,"onboarding_completed_at": string | null,"sex_for_equation": string,"timezone": string,"tracking_only_reasons": (string)[],"training_days_per_week": number | null,"training_minutes": number | null,"training_type": string | null,"typical_steps": number | null,"unit_system": string,"updated_at": string,"user_id": string,"avatar_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"created_at"?: string,"display_name"?: string | null,"goal_weight_kg"?: number | null,"height_cm"?: number | null,"hide_numbers"?: boolean,"mode"?: string,"onboarding_completed_at"?: string | null,"sex_for_equation"?: string,"timezone"?: string,"tracking_only_reasons"?: (string)[],"training_days_per_week"?: number | null,"training_minutes"?: number | null,"training_type"?: string | null,"typical_steps"?: number | null,"unit_system"?: string,"updated_at"?: string,"user_id": string,"avatar_path"?: string | null
                  }
                  Update: {
                    "birth_date"?: string | null,"created_at"?: string,"display_name"?: string | null,"goal_weight_kg"?: number | null,"height_cm"?: number | null,"hide_numbers"?: boolean,"mode"?: string,"onboarding_completed_at"?: string | null,"sex_for_equation"?: string,"timezone"?: string,"tracking_only_reasons"?: (string)[],"training_days_per_week"?: number | null,"training_minutes"?: number | null,"training_type"?: string | null,"typical_steps"?: number | null,"unit_system"?: string,"updated_at"?: string,"user_id"?: string,"avatar_path"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"recipe_ingredients": {
                  Row: {
                    "food_id": string | null,"id": string,"name_snapshot": string,"per100_carbs_g": number | null,"per100_fat_g": number | null,"per100_fibre_g": number | null,"per100_kcal": number | null,"per100_protein_g": number | null,"per100_sat_fat_g": number | null,"per100_sodium_mg": number | null,"raw_grams": number,"recipe_id": string,"sort_order": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "food_id"?: string | null,"id"?: string,"name_snapshot": string,"per100_carbs_g"?: number | null,"per100_fat_g"?: number | null,"per100_fibre_g"?: number | null,"per100_kcal"?: number | null,"per100_protein_g"?: number | null,"per100_sat_fat_g"?: number | null,"per100_sodium_mg"?: number | null,"raw_grams": number,"recipe_id": string,"sort_order"?: number,"user_id": string
                  }
                  Update: {
                    "food_id"?: string | null,"id"?: string,"name_snapshot"?: string,"per100_carbs_g"?: number | null,"per100_fat_g"?: number | null,"per100_fibre_g"?: number | null,"per100_kcal"?: number | null,"per100_protein_g"?: number | null,"per100_sat_fat_g"?: number | null,"per100_sodium_mg"?: number | null,"raw_grams"?: number,"recipe_id"?: string,"sort_order"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_ingredients_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "cooked_yield_g": number,"created_at": string,"food_id": string | null,"id": string,"name": string,"notes": string | null,"servings": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cooked_yield_g": number,"created_at"?: string,"food_id"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"servings": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "cooked_yield_g"?: number,"created_at"?: string,"food_id"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"servings"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipes_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_meal_items": {
                  Row: {
                    "assumptions": NonNullable<Json>,"food_id": string | null,"fraction_eaten": number,"grams": number,"id": string,"name_snapshot": string,"per100_carbs_g": number | null,"per100_fat_g": number | null,"per100_fibre_g": number | null,"per100_kcal": number | null,"per100_protein_g": number | null,"per100_sat_fat_g": number | null,"per100_sodium_mg": number | null,"provenance": string,"saved_meal_id": string,"serving_label": string | null,"sort_order": number,"source_name": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assumptions"?: NonNullable<Json>,"food_id"?: string | null,"fraction_eaten"?: number,"grams": number,"id"?: string,"name_snapshot": string,"per100_carbs_g"?: number | null,"per100_fat_g"?: number | null,"per100_fibre_g"?: number | null,"per100_kcal"?: number | null,"per100_protein_g"?: number | null,"per100_sat_fat_g"?: number | null,"per100_sodium_mg"?: number | null,"provenance": string,"saved_meal_id": string,"serving_label"?: string | null,"sort_order"?: number,"source_name"?: string | null,"user_id": string
                  }
                  Update: {
                    "assumptions"?: NonNullable<Json>,"food_id"?: string | null,"fraction_eaten"?: number,"grams"?: number,"id"?: string,"name_snapshot"?: string,"per100_carbs_g"?: number | null,"per100_fat_g"?: number | null,"per100_fibre_g"?: number | null,"per100_kcal"?: number | null,"per100_protein_g"?: number | null,"per100_sat_fat_g"?: number | null,"per100_sodium_mg"?: number | null,"provenance"?: string,"saved_meal_id"?: string,"serving_label"?: string | null,"sort_order"?: number,"source_name"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_meal_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_meal_items_saved_meal_id_fkey"
      columns: ["saved_meal_id"]
isOneToOne: false
      referencedRelation: "saved_meals"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_meals": {
                  Row: {
                    "created_at": string,"id": string,"last_used_at": string | null,"meal_type": string | null,"name": string,"updated_at": string,"use_count": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_used_at"?: string | null,"meal_type"?: string | null,"name": string,"updated_at"?: string,"use_count"?: number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_used_at"?: string | null,"meal_type"?: string | null,"name"?: string,"updated_at"?: string,"use_count"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"target_suggestions": {
                  Row: {
                    "created_at": string,"evidence": NonNullable<Json>,"goal_version_id": string | null,"id": string,"observed_tdee": number | null,"proposed_calorie_target": number,"proposed_protein_g": number | null,"resolved_at": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"evidence"?: NonNullable<Json>,"goal_version_id"?: string | null,"id"?: string,"observed_tdee"?: number | null,"proposed_calorie_target": number,"proposed_protein_g"?: number | null,"resolved_at"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"evidence"?: NonNullable<Json>,"goal_version_id"?: string | null,"id"?: string,"observed_tdee"?: number | null,"proposed_calorie_target"?: number,"proposed_protein_g"?: number | null,"resolved_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "target_suggestions_goal_version_id_fkey"
      columns: ["goal_version_id"]
isOneToOne: false
      referencedRelation: "goal_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"trainer_codes": {
                  Row: {
                    "code": string,"created_at": string,"expires_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"expires_at"?: string,"user_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"expires_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"trainer_links": {
                  Row: {
                    "created_at": string,"id": string,"member_user_id": string,"status": string,"trainer_name": string | null,"trainer_user_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"member_user_id": string,"status"?: string,"trainer_name"?: string | null,"trainer_user_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"member_user_id"?: string,"status"?: string,"trainer_name"?: string | null,"trainer_user_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_food_usage": {
                  Row: {
                    "favourite": boolean,"food_id": string,"last_used_at": string | null,"use_count": number,"user_id": string,"usual_grams": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "favourite"?: boolean,"food_id": string,"last_used_at"?: string | null,"use_count"?: number,"user_id": string,"usual_grams"?: number | null
                  }
                  Update: {
                    "favourite"?: boolean,"food_id"?: string,"last_used_at"?: string | null,"use_count"?: number,"user_id"?: string,"usual_grams"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_food_usage_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"water_logs": {
                  Row: {
                    "created_at": string,"id": string,"local_date": string,"logged_at": string,"ml": number,"tz": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"local_date": string,"logged_at"?: string,"ml": number,"tz": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"local_date"?: string,"logged_at"?: string,"ml"?: number,"tz"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"weight_logs": {
                  Row: {
                    "created_at": string,"external_id": string | null,"id": string,"kg": number,"local_date": string,"measured_at": string,"note": string | null,"source": string,"tz": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"external_id"?: string | null,"id"?: string,"kg": number,"local_date": string,"measured_at"?: string,"note"?: string | null,"source"?: string,"tz": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"external_id"?: string | null,"id"?: string,"kg"?: number,"local_date"?: string,"measured_at"?: string,"note"?: string | null,"source"?: string,"tz"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "daily_activity": {
                  Row: {
                    "local_date": string | null,"steps": number | null,"steps_source": string | null,"user_id": string | null,"workout_count": number | null,"workout_kcal": number | null,"workout_minutes": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"daily_totals": {
                  Row: {
                    "carbs_g": number | null,"carbs_unknown": number | null,"fat_g": number | null,"fat_unknown": number | null,"fibre_g": number | null,"fibre_unknown": number | null,"item_count": number | null,"kcal": number | null,"kcal_high": number | null,"kcal_low": number | null,"kcal_unknown": number | null,"local_date": string,"meal_count": number | null,"protein_g": number | null,"protein_unknown": number | null,"ranged_count": number | null,"sat_fat_g": number | null,"sat_fat_unknown": number | null,"sodium_mg": number | null,"sodium_unknown": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"daily_water": {
                  Row: {
                    "entries": number | null,"local_date": string,"ml": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_ai_cost":
{ Args: { "p_cost": number,"p_local_date": string,"p_user": string }; Returns: undefined
                           },
"link_trainer":
{ Args: { "p_code": string }; Returns: string
                           },
"make_trainer_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"trainer_members":
{ Args: { "p_days"?: number }; Returns: {
              "member_user_id": string,
"display_name": string,
"linked_at": string,
"days_logged": number,
"meals": number,
"avg_kcal": number | null,
"avg_protein_g": number | null,
"calorie_target": number | null,
"protein_target_g": number | null,
"workouts": number,
"workout_minutes": number,
"weight_first": number | null,
"weight_last": number | null,
"last_log_date": string | null
            }[]
                           },
"goal_for_date":
{ Args: { "p_date": string }; Returns: {
              "activity_level": string,
"activity_mode": string,
"calorie_target": number | null,
"carbs_g": number | null,
"created_at": string,
"effective_from": string,
"fat_g": number | null,
"fibre_g": number | null,
"goal_type": string,
"id": string,
"inputs": NonNullable<Json>,
"pace": number | null,
"protein_g": number | null,
"rationale": string | null,
"source": string,
"step_goal": number | null,
"user_id": string,
"water_ml": number | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "goal_versions"
        isOneToOne: false
        isSetofReturn: true
      } },
"increment_ai_usage":
{ Args: { "p_cap": number,"p_cost"?: number,"p_kind": string,"p_local_date": string,"p_user": string }; Returns: boolean
                           },
"search_foods":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "attribution": string,"brand": string,"carbs_g": number,"default_serving_g": number,"fat_g": number,"favourite": boolean,"fibre_g": number,"id": string,"kcal": number,"name": string,"owner_user_id": string,"protein_g": number,"rank_bucket": number,"sat_fat_g": number,"similarity": number,"sodium_mg": number,"source": string,"use_count": number,"usual_grams": number,"variant_label": string,"verified": boolean
            }[]
                           },
"touch_food_usage":
{ Args: { "p_food_id": string,"p_grams": number }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
