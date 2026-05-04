require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('reports')
    .select('id, status, verifications(notes)')
    .eq('status', 'rejected')
    .limit(5);
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}
test();
