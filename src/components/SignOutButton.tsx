import sharedStyles from './LightningApp.module.css';
import { Button } from '@mui/material';
import clsx from 'clsx';
import { signOut } from 'next-auth/react';

export default function SignOutButton() {
  return (
    <Button className={clsx(sharedStyles.button)} onClick={() => signOut()} sx={{ maxWidth: 'max-content' }}>
      Sign out
    </Button>
  );
}
