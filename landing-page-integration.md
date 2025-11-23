
# Landing Page Integration Guide

To display the services managed in your CRM on your landing page project (`HANSEN-IT-2025`), follow these steps:

## 1. Install Supabase Client (if not already installed)

In your `HANSEN-IT-2025` project:

```bash
npm install @supabase/supabase-js
```

## 2. Setup Supabase Client

Create a file `lib/supabaseClient.js` (or similar) in your landing page project. Point it to your CRM's Supabase URL.

```javascript
// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Replace these with your CRM project's credentials
const SUPABASE_URL = 'YOUR_CRM_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_CRM_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

## 3. Update HomePage (`app/page.jsx` or `app/page.js`)

Replace your static `HomePage` with one that fetches data. This version maps the dynamic data to your `ServiceCard` component.

```jsx
import HeroSection from "@/components/HeroSection";
import ServiceCard from "@/components/ServiceCard";
import SectionTitle from "@/components/SectionTitle";
import { supabase } from "@/lib/supabaseClient";

// This makes the page dynamic so it fetches new data on request (or use revalidate for caching)
export const dynamic = 'force-dynamic';

async function getServices() {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching services:', error);
    return [];
  }
  return data;
}

export default async function HomePage() {
  const services = await getServices();

  return (
    <>
      <HeroSection />
      <section className="py-16 container-default">
        <SectionTitle
          kicker="Våre tjenester"
          title="Alt du trenger for smartere IT-drift"
        />
        <div className="grid gap-8 mt-12 md:grid-cols-3">
          {services.length > 0 ? (
            services.map((service) => (
              <ServiceCard
                key={service.id}
                title={service.name}
                description={service.short_description}
                href={service.href || '#'} // Use the link from DB or default
                features={service.features || []} // Use features array from DB
              />
            ))
          ) : (
            <p className="text-center col-span-3 text-gray-500">Ingen tjenester funnet.</p>
          )}
        </div>
      </section>
    </>
  );
}
```

## 4. Ensure Database Access and Schema

1.  **Run Migration**: Make sure you have run the updated `migration.sql` in your CRM Supabase project. It adds the `features` and `href` columns and enables public read access.

    ```sql
    -- Essential parts of the update
    ALTER TABLE services ADD COLUMN IF NOT EXISTS href TEXT;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS features TEXT[];
    CREATE POLICY "Allow public read access" ON services FOR SELECT USING (true);
    ```

2.  **Add Data**: Go to your CRM Admin Dashboard (`/admin/services`) and add your services. Fill in the "Link" and "Features" fields.
