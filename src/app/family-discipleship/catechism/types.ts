export interface CatechismSummary {
  /** Catechism code/slug (e.g. "wsc", "matthew-henry"). Used as the catechismId
   *  for StudentCatechismProgress, so it must match the seeded `code`. */
  id: string;
  title: string;
  description: string;
  questionCount: number;
  difficulty: string;
}
