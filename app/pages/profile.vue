<!--app/pages/profile.vue-->
<script setup>
// Page for user profile - requires authentication
definePageMeta({
  middleware: "auth",
});
</script>

<template>
  <div>
    <UserProfile />
  </div>
</template>
