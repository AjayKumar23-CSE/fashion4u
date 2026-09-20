# Image storage (S3)

Product, category and content images are stored in an S3 bucket. The API never
receives image bytes: the admin asks `POST /admin/uploads` for a presigned URL
(valid 5 minutes, locked to one key and content type) and the browser uploads
the file straight to the bucket. The database stores the public URL.

Until the bucket is configured everything else works; only uploading reports
"Image storage is not set up".

## 1. Create the bucket

S3 console → Create bucket, region `ap-south-1` (Mumbai), any unique name.
Under **Block Public Access**, untick "Block all public access" so the read
policy in step 2 is allowed. Leave ACLs disabled.

## 2. Turn off Block Public Access first

Bucket → Permissions → **Block public access** → Edit → untick "Block all public
access" → Save → type `confirm`.

Do this **before** step 3. While it is on, S3 rejects the whole bucket policy
for containing a public statement, and the save appears to do nothing.

## 3. Grant public read and API upload in one policy

Bucket → Permissions → Bucket policy (replace `YOUR_BUCKET` and the user ARN):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadImages",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
    },
    {
      "Sid": "AllowApiUploads",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::ACCOUNT_ID:user/YOUR_IAM_USER" },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
    }
  ]
}
```

The second statement replaces the IAM policy in step 5 when the user and the
bucket are in the same account: either an identity policy or the bucket policy
can grant access, and only one is needed.

Keep this bucket for public images only. Invoices, labels and anything private
belong in a separate bucket with no public policy.

## 4. Allow the admin panel to upload from the browser

Bucket → Permissions → CORS. List every origin the admin runs on:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://admin.yourdomain.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

Only `PUT` is needed. Displaying an image with `<img>` and Next.js fetching it
server-side are both exempt from CORS, so `GET` does not belong here.

Without this the upload fails in the browser with a CORS error even though the
presigned URL is valid.

## 5. Credentials for the API (only if you skipped the policy in step 3)

IAM → Users → Create user (no console access) → attach this inline policy →
create an access key. It can only add objects; it cannot list, read or delete.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
    }
  ]
}
```

Do not use your root account's keys. On AWS hosting (EC2, ECS, App Runner),
attach the policy to the instance role instead and leave the key variables
empty: the SDK finds the role by itself.

## 6. Configure the apps

`apps/api/.env`:

```bash
AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET="YOUR_BUCKET"
S3_PUBLIC_URL="https://YOUR_BUCKET.s3.ap-south-1.amazonaws.com"
```

`apps/storefront/.env` — the same public URL, so Next.js will optimize images
from that host (it refuses hosts it has not been told about). Rebuild or
restart the storefront after changing it.

```bash
S3_PUBLIC_URL="https://YOUR_BUCKET.s3.ap-south-1.amazonaws.com"
```

Restart the API, sign in to the admin, open a product and add an image.

## Keeping it inside the free tier

- The storefront does not hotlink S3 for every visitor. Next.js fetches each
  original once, then serves its own resized WebP copies from cache, so S3 GET
  requests grow with the number of images, not with traffic.
- Uploads are capped at 5 MB in the admin and stored with a one-year
  `Cache-Control`. Object keys are random, so a replaced image gets a new URL
  and never serves stale.
- Check the current AWS free-tier terms for your account: the allowances differ
  between older 12-month accounts and newer credit-based ones.

## Moving existing images into the bucket

`npm run db:seed` writes image paths that point at the storefront's own
`public/` folder. To move those files into S3 and repoint the database:

```bash
npm run images:to-s3 -- --dry-run   # list what would be uploaded
npm run images:to-s3
```

It skips rows that already hold a URL, so it is safe to re-run, and it repoints
each row only after that file uploads. Re-seeding resets the rows to local
paths, so run it again after any re-seed.

## Later

- Put CloudFront in front of the bucket, set `S3_PUBLIC_URL` to the CloudFront
  domain in both apps and turn Block Public Access back on (origin access
  control). No code changes are needed.
- Removing an image in the admin does not delete the object from S3 yet, so
  unused files accumulate. Deleting needs `s3:DeleteObject` and a cleanup job.
- A presigned PUT cannot enforce a maximum size server-side; the 5 MB limit is
  checked in the admin only. Presigned POST policies can enforce it if staff
  accounts ever become less trusted.

## Local development without AWS

Set `S3_ENDPOINT` to any S3-compatible server (for example MinIO at
`http://localhost:9000`) and point `S3_PUBLIC_URL` at it in both apps.
