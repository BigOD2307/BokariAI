import { Metadata } from 'next';
import Landing from '@/components/home/Landing';

export const metadata: Metadata = {
  title: 'Bokari — Le journaliste IA africain',
  description:
    "Posez votre question : Bokari recherche, vérifie et synthétise l'information avec des sources citées. Conçu pour l'Afrique.",
};

export default function Page() {
  return <Landing />;
}
