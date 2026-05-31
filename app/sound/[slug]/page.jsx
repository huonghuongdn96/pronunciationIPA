import PronunciationApp from '../../PronunciationApp';

export default function SoundPage({ params }) {
  return <PronunciationApp initialSlug={params.slug} />;
}
