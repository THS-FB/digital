# Tunstall visitor and sponsor analytics

Status: prepared, NOT collecting data. `js/analytics.js` intentionally has an empty Measurement ID. The owner must create or choose a Google Analytics 4 property and provide its G- Measurement ID before activation.

## Owner setup

1. Open https://analytics.google.com/ and use the Google account that should own Tunstall's reports.
2. Create an account/property named Tunstall Football (or choose the existing property). Reporting time zone: United States / New York; currency: USD.
3. Add a Web data stream for https://ths-fb.github.io/digital/ and copy its G- Measurement ID. No password or secret is needed by the website developer.
4. Under Admin > Custom definitions, create Event-scoped dimensions for `sponsor_id`, `sponsor_name`, `source_page`, `placement`, and `program_page`.

## Activation and verification

Set MEASUREMENT_ID in js/analytics.js, publish, then use Realtime/DebugView to verify actual receipt of page_view and sponsor_click events. Local tests use a fake ID and do not send events. Check Home, Schedule, Roster, Partners and Program; click a sponsor on the Partners page and in the online PDF, and test a /go/ link. Check the right property before declaring tracking live. Standard/custom reports can take 24–48 hours. Final activation should include a suitable site analytics disclosure and any required consent configuration.

## Reports

Use Pages and screens for site page views and users. Build a sponsor Exploration filtered to event name `sponsor_click`, with Sponsor name, Source page, Placement and Program page as rows, and Event count and Total users as values. Filter the date range for weekly or season reports. Never sum generic outbound `click` and `sponsor_click` events as a single click total.

Existing website destinations and Elizabeth Ware's UTM parameters are preserved. Delegated click tracking covers dynamically rendered PDF links and middle clicks. Same-tab navigation has a bounded fallback if Google is blocked. Advertising personalization and Google signals are disabled. Query strings are omitted from explicitly configured page_location. Counts are measured activity, not a complete census, and clicks do not prove purchases or coupon redemptions. A page view is not proof that every sponsor on the page was seen.

## Downloadable PDFs and QR codes

Nine fixed-destination /go/<sponsor-id>/ links are prepared. Append `?from=pdf` or `?from=qr` to distinguish distribution sources. Destinations are allowlisted in code; arbitrary redirect targets are not accepted. Redirect pages emit sponsor_click without a synthetic page_view and always continue to the destination even if analytics is blocked.

Current PDFs have NOT been rewritten. Website and online-program sponsor clicks are covered by the site script after activation. Offline/downloaded PDF clicks require replacing their embedded links with these redirects in a separate PDF update. Previously distributed files will keep their old links. Reading pages inside an offline PDF cannot be measured by this implementation. The online flipbook click event records its numbered PDF page, but flipbook page-turn views are not implemented.

## Validation

Run `node tests/analytics.test.cjs` and `node --check js/analytics.js`. Tests cover no-ID behavior, configuration, named sponsor clicks, PDF page attribution, unrelated links, middle clicks, navigation fallback, one redirect event and preservation of the sponsor UTM destination. Receipt in Google's account remains an activation gate.
