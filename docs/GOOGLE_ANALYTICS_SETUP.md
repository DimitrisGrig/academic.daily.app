# Google Analytics Setup Guide

This application has been configured with Google Analytics 4 (GA4) for tracking user interactions and page views.

## Setup Instructions

### 1. Create a Google Analytics Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new GA4 property or use an existing one
3. Get your **Measurement ID** (format: `G-XXXXXXXXXX`)

### 2. Configure Environment Variables

Add your Google Analytics Measurement ID to the appropriate environment file:

**For Development** (`.env.development`):

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**For Production** (`.env.production`):

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. Rebuild the Application

After adding the Measurement ID, rebuild your application:

```bash
npm run build
```

## Features Implemented

### Automatic Page View Tracking

The app automatically tracks page views whenever users navigate between routes. This includes:

- Main Feed
- Explore
- History
- Bookmarks
- Custom Feeds
- Tags
- Settings
- Search Results
- Article views
- And all other routes

### Custom Event Tracking

You can track custom events using the `logEvent` function from `lib/analytics.ts`:

```typescript
import { logEvent } from "@/lib/analytics";

// Track a custom event
logEvent("Button", "Click", "Subscribe Button");
```

**Parameters:**

- `category`: The category of the event (e.g., 'Button', 'Form', 'Video')
- `action`: The action performed (e.g., 'Click', 'Submit', 'Play')
- `label`: (Optional) Additional context for the event

### Example Use Cases

```typescript
// Track article interactions
logEvent("Article", "Bookmark", articleId);

// Track search queries
logEvent("Search", "Query", searchTerm);

// Track tag selections
logEvent("Tags", "Select", tagName);

// Track feed interactions
logEvent("Feed", "Refresh", "Main Feed");
```

## Implementation Details

### Files Modified/Created

1. **`frontend/src/lib/analytics.ts`** - Core analytics utility functions
2. **`frontend/src/App.tsx`** - Added Analytics component for route tracking
3. **`frontend/src/main.tsx`** - Initialize GA on app load
4. **`frontend/index.html`** - Added GA gtag script
5. **`frontend/vite.config.ts`** - Added HTML transform plugin for env vars
6. **`.env.development`** and **`.env.production`** - Added GA configuration

### Privacy Considerations

- Google Analytics only initializes if a Measurement ID is provided
- No tracking occurs in development unless explicitly configured
- Consider adding a cookie consent banner for GDPR compliance
- You can implement opt-out functionality if needed

## Verifying Installation

### Check Browser Console

After starting the app with a valid Measurement ID, you should see:

```
Google Analytics initialized
```

### Real-time Reports

1. Go to your Google Analytics dashboard
2. Navigate to Reports → Real-time
3. Open your application and navigate between pages
4. You should see active users and page views in real-time

### Debug Mode

To enable GA debug mode, add this to your component:

```typescript
import ReactGA from "react-ga4";

ReactGA.initialize(MEASUREMENT_ID, {
  gaOptions: {
    debug_mode: true,
  },
});
```

## Troubleshooting

### Events Not Showing Up

- Verify your Measurement ID is correct
- Check browser console for any errors
- Ensure ad blockers are disabled (they often block GA)
- Wait a few minutes - GA can have a delay in reporting

### Development Testing

To test GA in development:

1. Add your Measurement ID to `.env.development`
2. Restart the dev server
3. Open browser DevTools → Network tab
4. Filter for "google-analytics" or "collect"
5. You should see network requests to GA

## Additional Resources

- [Google Analytics 4 Documentation](https://support.google.com/analytics/answer/10089681)
- [react-ga4 Library](https://github.com/codler/react-ga4)
- [GA4 Event Reference](https://developers.google.com/analytics/devguides/collection/ga4/events)
