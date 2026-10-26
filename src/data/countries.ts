import { parseCountryRow, PRESET_COUNTRIES, type CountryProfile } from '../domain/country'
import { supabase } from '../lib/supabase'

export async function loadCountries(): Promise<CountryProfile[]> {
  const { data, error } = await supabase
    .from('countries')
    .select('code,name,currency,locale,tax_label,tax_rate,prices_include_tax,enabled,sort_order')
    .order('sort_order', { ascending: true })
  if (error || !Array.isArray(data) || data.length === 0) {
    return PRESET_COUNTRIES
  }
  const parsed = data.map((row) => parseCountryRow(row)).filter((row): row is CountryProfile => row != null)
  return parsed.length > 0 ? parsed : PRESET_COUNTRIES
}
