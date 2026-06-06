import { createClient } from '@supabase/supabase-js'

let _client = null
export const supabaseAdmin = new Proxy({}, {
  get(_, prop) {
    if (!_client) {
      _client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    }
    const val = _client[prop]
    return typeof val === 'function' ? val.bind(_client) : val
  }
})
