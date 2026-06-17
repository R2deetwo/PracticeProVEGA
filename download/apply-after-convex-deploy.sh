#!/bin/bash
#
# apply-after-convex-deploy.sh
#
# PURPOSE:
#   Re-applies the Task 8 frontend changes that depend on the new Convex
#   function signatures (getUser with preferPortalRole, verifyLogin with
#   portalType, markInboundMessagesReadByTenant, findDuplicateEmails).
#
#   These changes were reverted in Task 9 (commit e571b89) to unblock the
#   app after the "System Connection Interrupted" crash. They are safe to
#   re-apply AFTER `npx convex deploy` has been run successfully.
#
# PREREQUISITES:
#   1. You have run `npx convex deploy` from the project root
#   2. The deploy succeeded (check the output for "Deployed to production")
#   3. You can see the new functions in the Convex dashboard:
#      - api.myFunctions.findDuplicateEmails
#      - api.portals.markInboundMessagesReadByTenant
#      - api.myFunctions.getUser (with preferPortalRole arg)
#      - api.myFunctions.verifyLogin (with portalType arg)
#
# USAGE:
#   cd /home/z/my-project
#   bash download/apply-after-convex-deploy.sh
#
#   Then commit and push:
#     git add -A
#     git commit -m "re-apply: Task 8 frontend changes (Convex now deployed)"
#     git push origin main
#
# WHAT THIS SCRIPT DOES:
#   1. Re-applies preferPortalRole to the getUser query in AuthContext
#   2. Re-applies portalType param to login() and verifyLogin call
#   3. Re-applies portalType:'tenant' to TenantPortalLogin
#   4. Re-applies portalType:'client' to ClientPortalLogin
#   5. Switches TenantPortal MessagesTab from api.sentry.markMessageAsRead
#      (workaround) to api.portals.markInboundMessagesReadByTenant (proper fix)
#   6. Re-applies handlePreviewWithDuplicateCheck in PortalAccessSettings
#
# After this script runs, the residents-see-admin-dashboard bug (login case)
# is fully fixed, and the message badge uses the proper batch mutation.
#

set -e

cd /home/z/my-project

echo "=== Checking prerequisites ==="
if ! grep -q "preferPortalRole" convex/myFunctions.ts 2>/dev/null; then
  echo "ERROR: convex/myFunctions.ts does not have preferPortalRole."
  echo "       Make sure you're on the latest commit and Convex is deployed."
  exit 1
fi

echo ""
echo "=== This script will re-apply the Task 8 frontend changes. ==="
echo "=== Press Ctrl+C to cancel, or Enter to continue. ==="
read -r

echo ""
echo "=== Applying changes via git patch... ==="
echo "(This would apply the patch file. For safety, the actual patch is in)"
echo "(download/task8-frontend.patch — review it first if you're unsure.)"

if [ -f download/task8-frontend.patch ]; then
  git apply download/task8-frontend.patch
  echo "=== Patch applied successfully. ==="
  echo ""
  echo "=== Next steps: ==="
  echo "  1. Run: npx tsc --noEmit   (should be clean except src/app/page.tsx)"
  echo "  2. Run: npx vite build     (should succeed)"
  echo "  3. git add -A"
  echo "  4. git commit -m 're-apply: Task 8 frontend changes (Convex now deployed)'"
  echo "  5. git push origin main"
else
  echo "ERROR: download/task8-frontend.patch not found."
  echo "       The patch file should have been created alongside this script."
  exit 1
fi
