import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://rgbqpybaeojhrbqgxtui.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnYnFweWJhZW9qaHJicWd4dHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDU4MTQsImV4cCI6MjA5NDY4MTgxNH0.cqhhIuV0WC4c1BzuiL-RJHSBmR-TwfgygqAB-DexUqg"

export const supabase = createClient(supabaseUrl, supabaseKey)
