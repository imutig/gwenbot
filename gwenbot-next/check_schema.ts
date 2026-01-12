
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .limit(1)

    if (error) {
        console.error('Error:', error)
    } else {
        if (data && data.length > 0) {
            console.log('Columns:', Object.keys(data[0]))
        } else {
            console.log('Table empty or no data, cannot infer columns easily without system tables. Trying to fetch generic row.')
            // If empty, we can't see columns this way easily without system permissions. 
            // But we can try to Select a column 'avatar_seed' and see if it errors.
            const { error: colError } = await supabase.from('players').select('avatar_seed').limit(1)
            if (colError) console.log('Avatar seed column likely missing:', colError.message)
            else console.log('Avatar seed column exists!')
        }
    }
}

checkSchema()
