// test-supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabase_1 = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function test() {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Service role key / URL failed:', error.message);
  } else {
    console.log('✅ Service role connection works. Rows found:', data.length);
  }
}

test();