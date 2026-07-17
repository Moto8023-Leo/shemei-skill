# Facebook API Token Setup Guide

Step-by-step instructions to get your free Facebook Page Access Token.

⏱️ **Time needed:** 10-15 minutes (one-time setup)
💰 **Cost:** Free, unlimited Page posting

---

## Overview

You need 3 things:
1. **FB_PAGE_ID** — Your Facebook Page's numeric ID
2. **FB_ACCESS_TOKEN** — A long-lived Page Access Token (60 days, auto-renews)
3. **IG_USER_ID** — Instagram Business Account ID (optional, for Instagram posting)

---

## Step 1: Create a Meta App

1. Go to https://developers.facebook.com/
2. Log in with your Facebook account
3. Click **"My Apps"** (top right) → **"Create App"**
4. Select **"Other"** → **"Business"** (or "Other")
5. Name your app (e.g. "MySocialAuto") → **"Create App"**

📸 *Your app dashboard should now show the App ID*

---

## Step 2: Add Facebook Login Product (Required for Token Generation)

1. In your app dashboard, find **"Add Product"**
2. Select **"Facebook Login"** → **"Set Up"**
3. Choose **"Web"** (you don't need to actually use it)
4. Site URL: enter `http://127.0.0.1:8000` (just a placeholder)
5. Save and ignore the SDK setup instructions

---

## Step 3: Get a Short-Lived Page Access Token

1. Go to https://developers.facebook.com/tools/explorer/
2. On the right panel:
   - **"Meta App"**: Select your app
   - **"User or Page"**: Select **"Get Page Access Token"** ← IMPORTANT!
3. Permission popup appears. Check **ALL** of these:
   - ✅ `pages_show_list`
   - ✅ `pages_manage_posts`
   - ✅ `pages_read_engagement`
   - ✅ `instagram_basic` (if using Instagram)
   - ✅ `instagram_content_publish` (if using Instagram)
4. Click **"Generate Access Token"**
5. A second popup asks you to **select your Page** → select it
6. Copy the generated token (starts with `EAAP...`)

---

## Step 4: Exchange for Long-Lived Token

The token from Step 3 expires in 1-2 hours. Exchange it for one that lasts 60 days.

### Option A: Use our setup tool (recommended)

```bash
python scripts/setup_auth.py --platform fb
```
It will guide you through the exchange automatically.

### Option B: Manual exchange

Open this URL in your browser (replace placeholders):

```
https://graph.facebook.com/v22.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={YOUR_APP_ID}
  &client_secret={YOUR_APP_SECRET}
  &fb_exchange_token={YOUR_SHORT_TOKEN}
```

Find App ID and App Secret at: https://developers.facebook.com/ → Your App → Settings → Basic

The response contains your **long-lived token**:
```json
{
  "access_token": "EAAP...NewLongToken...",
  "token_type": "bearer",
  "expires_in": 5184000
}
```

---

## Step 5: Get Your Page ID

### Method 1: From Page URL
Go to your Facebook Page. The URL looks like:
```
facebook.com/YourPageName-123456789012345
```
The last number is your Page ID.

### Method 2: Via Graph API Explorer
In the Graph API Explorer, run:
```
GET /me/accounts
```
Find your page in the response → copy `"id"`.

---

## Step 6: Get Instagram Business Account ID (Optional)

**Only needed if you want to post to Instagram.**

Prerequisites:
- Your Instagram account must be a **Professional account** (Business or Creator)
- It must be **connected** to the Facebook Page from Step 5

In Graph API Explorer, run:
```
GET /{page-id}?fields=instagram_business_account{id,username}
```

Copy the `id` from the `instagram_business_account` object → This is your `IG_USER_ID`.

If you get `""instagram_business_account": null`, your Instagram is not connected to this FB Page. Go to your Page Settings → Instagram → Connect.

---

## Step 7: Fill in .env

Open `social-auto/.env` and fill in:

```env
FB_PAGE_ID=427194300466526
FB_ACCESS_TOKEN=EAAP...long-lived-token...
IG_USER_ID=17841469359028527    # Optional, for Instagram
```

---

## Step 8: Verify

```bash
cd social-auto
python scripts/validate_tokens.py
```

Should show:
```
[OK] Facebook: Page: Your Page Name
[OK] Instagram: IG: @your_instagram_username
```

---

## Test Post

```bash
# Text only
python post_now.py "Hello from my auto-poster!" --platform fb

# With image
python post_now.py "Product launch!" --platform fb --image "data/images/photo.jpg"

# FB + Instagram
python post_now.py "Multi-platform!" --platform fb,ig --image "data/images/photo.jpg"
```

---

## Token Expiry

- **Long-lived token** lasts 60 days
- Facebook automatically extends it when you actively use the token
- If it expires, run `python scripts/setup_auth.py --platform fb` again

---

## Troubleshooting

| Error | Solution |
|---|---|
| "(#200) permissions" | Token missing `pages_manage_posts` or `pages_read_engagement`. Re-generate in Step 3. |
| "(#190) access token expired" | Token expired. Re-do Step 4 with a fresh short token. |
| "instagram_business_account: null" | IG not connected to FB Page. Check Page Settings → Instagram. |
| "(#100) unsupported post request" | Using User token instead of Page token. Make sure Step 3 selected "Get Page Access Token". |
