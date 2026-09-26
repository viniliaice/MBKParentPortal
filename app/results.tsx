import { MarksScreen } from '@/components/MarksScreen';

/**
 * Kept so existing links, notification routes and the More menu keep working:
 * `/results` is the pushed presentation of the marks screen, with a back button.
 * The tab at `(tabs)/marks` renders the same component.
 */
export default function ResultsScreen() {
  return <MarksScreen showBack />;
}
