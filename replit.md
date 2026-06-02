# Glass and Door Pro - Charlotte, NC

## Overview

This is a business website for Glass and Door Pro, a glass installation company serving the Charlotte, NC metropolitan area. The site showcases services including frameless shower doors, window installation, door installation, window repair, and commercial glass. It features a modern React frontend with service pages, testimonials, gallery with lightbox, and contact functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **UI Components**: shadcn/ui component library (New York style)
- **State Management**: TanStack React Query for server state
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **API Pattern**: RESTful endpoints under `/api` prefix
- **Development**: Vite middleware with SSR via `vite.ssrLoadModule`
- **Production**: Express SSR — each page request is server-rendered from `dist/server/entry-server.cjs`, then per-route head tags (title, description, canonical, OG) are injected into `dist/public/index.html` before sending the response

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Managed via `drizzle-kit push`
- **Current Storage**: In-memory storage implementation (`MemStorage` class) with interface ready for database migration

### Project Structure
```
client/           # React frontend application
  src/
    components/   # Reusable UI components
    pages/        # Route page components
    hooks/        # Custom React hooks
    lib/          # Utilities and query client
    assets/       # Images and videos
    entry-client.tsx  # Client hydration entry (hydrateRoot)
    entry-server.tsx  # SSR render entry (renderToString)
server/           # Express backend
  index.ts        # Server entry point
  routes.ts       # API route definitions
  storage.ts      # Data persistence layer
  static.ts       # Production SSR handler
  vite.ts         # Dev SSR handler
  page-meta.ts    # Per-route head tag registry + buildHeadTags()
shared/           # Shared types and schemas
script/
  build.mjs       # Build: client → SSR bundle → server bundle
```

### Key Design Decisions

1. **Monorepo Structure**: Single repository with separate client/server folders sharing types through `shared/` directory. This enables type safety across the stack.

2. **shadcn/ui Components**: Pre-built accessible components with Radix UI primitives. Components are copied into the project (not npm dependencies) allowing full customization.

3. **CSS Variables Theming**: Custom color scheme using CSS custom properties defined in `client/src/index.css`. Uses teal blue primary color matching the company logo.

4. **Service Pages Pattern**: Individual pages for each service (`/services/*`) with SEO-focused content targeting Charlotte, NC area keywords.

5. **Scroll Behavior**: Custom `ScrollToTop` component resets scroll position on route changes. Hash-based navigation for single-page sections on home page.

6. **React SSR**: Full server-side rendering using `renderToString` with wouter's `ssrPath` prop. The build produces a separate CJS SSR bundle (`dist/server/entry-server.cjs`). Every page request is server-rendered; the client hydrates with `hydrateRoot`. Per-route `<title>`, `<meta description>`, canonical, og:title, og:description, og:url, twitter:title, and twitter:description are injected by `server/page-meta.ts` before the HTML response is sent. The `PRODUCTION_DOMAIN=glassanddoorpro.com` env var controls OG image URLs.

## External Dependencies

### Frontend Libraries
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight client-side routing
- **react-hook-form** + **zod**: Form validation
- **lucide-react**: Icon library
- **embla-carousel-react**: Carousel/slider functionality
- **date-fns**: Date formatting utilities

### Backend Libraries
- **express**: Web server framework
- **drizzle-orm**: Database ORM (PostgreSQL)
- **connect-pg-simple**: PostgreSQL session store
- **express-session**: Session management

### Build Tools
- **vite**: Frontend build and dev server
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- Schema uses `gen_random_uuid()` for ID generation
- Drizzle migrations stored in `/migrations` directory

### External Services
- **Google Fonts**: Montserrat and Open Sans font families loaded via CDN
- Email contact: Uses `mailto:` links to `Doug@GlassandDoorPro.com`