# Memo Book Mobile App (React Native + Expo)

Android client application for **Invoice Managerium (Memo Book)**. Designed to match the web platform with native mobile gestures, POS thermal receipt printing, and offline caching.

---

## Tech Stack
- **Framework:** React Native 0.88.1 (Expo SDK 58)
- **Routing:** Expo Router (`app/` filesystem-based routes)
- **Storage:** `expo-secure-store` for JWT session tokens; `@react-native-async-storage/async-storage` for offline cache
- **Printing:** `expo-print` + `expo-sharing`
- **Network Monitoring:** `@react-native-community/netinfo`
- **Typography:** Manrope & Inter via `@expo-google-fonts`
- **Icons:** `@expo/vector-icons` (Ionicons)

---

## App Architecture
```
mobile/
├── app/
│   ├── (auth)/                # Login, Register, Forgot Password
│   ├── (owner)/               # Owner dashboard
│   │   ├── products.tsx       # Products catalog & limits
│   │   ├── invoices.tsx       # Create Invoice + Invoice History + POS Preview
│   │   ├── plans.tsx          # Subscription plans & purchase
│   │   ├── profile.tsx        # Merchant shop & user profile
│   │   └── shop-setup.tsx     # 3-step onboarding wizard
│   ├── (admin)/               # Admin management console
│   │   ├── overview.tsx       # Stats & quick pending approvals
│   │   ├── pending.tsx        # Review & approve/reject subscriptions
│   │   ├── subscriptions.tsx  # All subscriptions + Plans manager
│   │   └── profile.tsx        # Admin profile & maintenance
├── src/
│   ├── api/
│   │   ├── client.ts          # Authenticated fetch wrapper with token refresh
│   │   └── cache.ts           # Local offline cache layer with timestamping
│   ├── components/            # Reusable design system UI components
│   ├── theme/                 # Design tokens (colors, typography, spacing, radii)
│   └── utils/                 # Session, network hooks, and receipt printing
```

---

## Build & Run

### Development
```bash
cd mobile
npm install
npx expo start
```

### EAS Cloud Build (Android Preview APK)
```bash
cd mobile
npx eas-cli build -p android --profile preview
```

### Production Release (Android AAB)
```bash
cd mobile
npx eas-cli build -p android --profile production
```
