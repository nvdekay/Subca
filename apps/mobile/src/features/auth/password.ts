import { supabase } from '@/lib/supabase';
import { supabaseStorage } from '@/lib/storage';
import { createPasswordFlow } from './password-flow';

export const passwordFlow = createPasswordFlow(supabase.auth, supabaseStorage);
