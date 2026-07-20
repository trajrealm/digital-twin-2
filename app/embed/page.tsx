import EmbedWidgetClient from './EmbedWidgetClient';

export default function EmbedPage() {
  return (
    <EmbedWidgetClient
      authorFirstName={process.env.NEXT_PUBLIC_AUTHOR_FIRST_NAME ?? 'the'}
      authorLastName={process.env.NEXT_PUBLIC_AUTHOR_LAST_NAME ?? 'author'}
    />
  );
}