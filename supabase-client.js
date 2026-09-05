/* LKS Systems — shared Supabase client for login.html & portal.html
   Replace the two values below with your project's URL and anon/public
   key from Supabase → Project Settings → API. Never put the "service_role"
   secret key here — only the anon/public key is safe in browser code. */

var SUPABASE_URL = "https://uvmqenwhbdtvcxmlqotb.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bXFlbndoYmR0dmN4bWxxb3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMDE2MzksImV4cCI6MjEwMjU3NzYzOX0.nd15Tmp9BBTNqT7o8uy1y1TCHHDcm7Wa8oPQ2uvR3dY";

var supabaseConfigured =
  SUPABASE_URL.indexOf("REPLACE_WITH") === -1 &&
  SUPABASE_ANON_KEY.indexOf("REPLACE_WITH") === -1;

var supabaseClient = supabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
