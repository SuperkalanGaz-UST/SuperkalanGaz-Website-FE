# Delivery Rider invitation links

The production invitation URL is:

```text
https://<APP_LINK_HOST>/delivery-rider-invitation?token=<single-use-token>
```

The same host serves the invitation-authorized web registration page and verifies
the native app. When the app is installed, iOS Universal Links and Android App
Links can open the mobile registration flow. On a laptop or a device without the
app, the web page completes the same locked invitation review, password creation,
PH mobile verification, and acceptance sequence through the NestJS API. After
activation, the web page directs the Delivery Rider to the mobile app; it never
provides a Delivery Rider operations dashboard.

If Supabase falls back to the configured Site URL after verifying the email, the
web root recognizes the protected pending `driver` session and redirects to
`/delivery-rider-invitation?session=verified`. The API accepts that session only
on invitation-activation endpoints; it cannot access Delivery Rider operations.

## Deployment values

1. Set `APP_LINK_HOST` in the mobile build environment to the HTTPS hostname.
2. Set `DELIVERY_RIDER_INVITATION_REDIRECT_URL` in the API to the HTTPS URL above
   without a token. Add a path-scoped redirect rule in Supabase Auth that permits
   the server-appended `token` query value, such as
   `https://<APP_LINK_HOST>/delivery-rider-invitation**`.
3. Set the optional `MOBILE_APP_ANDROID_DOWNLOAD_URL` and
   `MOBILE_APP_IOS_DOWNLOAD_URL` values in the web deployment.
4. Replace every placeholder in the JSON templates in this directory.
5. Deploy the completed files at the exact paths below with an
   `application/json` content type and no redirect:

```text
/.well-known/apple-app-site-association
/.well-known/assetlinks.json
```

Do not publish the templates with placeholders. The Apple Team ID and the SHA-256
fingerprint of the actual Android signing certificate are deployment-owned
values and cannot be inferred safely from the source repository.

Changing `APP_LINK_HOST`, associated domains, or Android intent filters requires
a new native app build; Expo Go does not verify production Universal Links or
Android App Links.
