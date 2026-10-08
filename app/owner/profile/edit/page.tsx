import ProfileEditForm from '@/components/profile/ProfileEditForm';

// Navbar & Footer sudah dirender oleh app/owner/layout.tsx
export default function OwnerEditProfilePage() {
  return <ProfileEditForm backHref="/owner/profile" />;
}
