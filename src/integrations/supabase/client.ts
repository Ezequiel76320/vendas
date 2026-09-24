import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zxgkamebwcyzeutkoved.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_sLtR1auvMAnOPtg1xATeww_PEqFx-hl";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
