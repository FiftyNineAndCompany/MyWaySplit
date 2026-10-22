import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xmegtdhjigtqsljagwiv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZWd0ZGhqaWd0cXNsamFnd2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTA4ODEsImV4cCI6MjA4Njc4Njg4MX0.5WQ44IJYYCimkRRMeRPETWH0bzEY8th3VFDfOSyUcKQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
