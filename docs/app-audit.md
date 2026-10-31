# App Audit — Invoice Managerium Mobile

**API Base:** `https://api.memobook.shop/api`  
**App Name:** Memo Book  
**Backend:** Node.js/Express + MongoDB Atlas  
**Frontend (web):** React + Vite + Tailwind  

---

## Screens (Web → Mobile)

| Web Route | Screen | Role |
|---|---|---|
| `/login` | LoginScreen | All |
| `/register` | RegisterScreen | All |
| `/forgot-password` | ForgotPasswordScreen | All |
| `/shop-setup` | ShopSetupScreen (3-step wizard) | Owner (customer) |
| `/dashboard` | OwnerDashboard (tabs: Products, Invoices, Plans, Profile) | Owner |
| `/admin/dashboard` | AdminDashboard (tabs: Overview, Pending, All Subs, Profile) | Admin |

---

## Key API Endpoints

### Auth (`/api/user`)
| Method | Path | Description |
|---|---|---|
| POST | `/register` | Register; returns `access_token` + `user` |
| POST | `/login` | Login; returns `access_token` + `user` |
| POST | `/forget-password` | Send OTP to email |
| POST | `/verify-otp` | Verify OTP |
| POST | `/reset-password` | Reset password with OTP |
| GET | `/` | Get current user (`Authorization: Bearer`) |
| PUT | `/update-profile` | Update profile |
| POST | `/refresh-token` | Refresh access token (cookie or body) |
| POST | `/logout` | Logout |

### Shop (`/api/shop`)
| Method | Path | Description |
|---|---|---|
| POST | `/create` | Create shop (owner) |
| GET | `/my` | Get my shop |
| PUT | `/update` | Update shop |

### Products (`/api/product`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | List own + demo products |
| POST | `/create` | Create product (multipart) |
| PUT | `/:id` | Update product |
| DELETE | `/:id` | Delete product |

### Invoices (`/api/invoice`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | List invoices |
| POST | `/create` | Create invoice |
| GET | `/:id` | Get invoice by ID |
| PUT | `/:id` | Update invoice |
| DELETE | `/:id` | Soft delete (`is_deleted`) |

### Subscriptions (`/api/subscription`)
| Method | Path | Description |
|---|---|---|
| GET | `/plans` | List all plans (public) |
| GET | `/my` | My subscription |
| POST | `/purchase` | Purchase plan |
| GET | `/admin/stats` | Admin stats |
| GET | `/admin/subscriptions` | All subscriptions |
| PUT | `/admin/subscriptions/:id` | Approve/Reject |
| GET | `/admin/plans` | List plans (admin) |
| POST | `/admin/plans` | Create plan |
| PUT | `/admin/plans/:id` | Update plan |
| DELETE | `/admin/plans/:id` | Delete plan |

---

## Auth Flow (Mobile)
- `POST /login` → receive `access_token` in body (+ refresh_token with `x-client: mobile` header)
- Store `access_token` in `expo-secure-store` 
- On 401 → call `POST /refresh-token` with `{ refresh_token }` → new access_token
- If refresh fails → logout

## Roles
- `customer` → Owner flow (ShopSetup → Dashboard with Products, Invoices, Plans, Profile)
- `admin` → Admin flow (Overview, Pending, All Subs, Profile)

## Plan Limits
- Free plan: PDF/Print locked, limited products & invoices/month
- Paid plans: unlock PDF export, more products, more invoices

## Design Tokens
- Primary: `#005C72` (Deep Sea teal)
- Fonts: Manrope (headline), Inter (body/label)
- Surface: `#f8fafb`, Error: `#ba1a1a`

