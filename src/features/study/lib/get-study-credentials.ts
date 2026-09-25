import "server-only";

export type StudyCredentials = {
  coolUsername: string;

  coolPassword: string;

  mailUsername: string;

  mailPassword: string;
};

type StudyAccountConfig = {
  userId: string | undefined;

  credentials: Partial<StudyCredentials>;
};

const accounts: StudyAccountConfig[] = [
  {
    userId: process.env.STUDY_YAO_USER_ID,

    credentials: {
      coolUsername: process.env.STUDY_YAO_COOL_USERNAME,

      coolPassword: process.env.STUDY_YAO_COOL_PASSWORD,

      mailUsername: process.env.STUDY_YAO_MAIL_USERNAME,

      mailPassword: process.env.STUDY_YAO_MAIL_PASSWORD,
    },
  },

  {
    userId: process.env.STUDY_AN_USER_ID,

    credentials: {
      coolUsername: process.env.STUDY_AN_COOL_USERNAME,

      coolPassword: process.env.STUDY_AN_COOL_PASSWORD,

      mailUsername: process.env.STUDY_AN_MAIL_USERNAME,

      mailPassword: process.env.STUDY_AN_MAIL_PASSWORD,
    },
  },
];

export function getStudyCredentials(userId: string): StudyCredentials {
  const account = accounts.find((item) => item.userId === userId);

  if (!account) {
    throw new Error("Study integration is not configured for this user.");
  }

  const { coolUsername, coolPassword, mailUsername, mailPassword } =
    account.credentials;

  if (!coolUsername || !coolPassword) {
    throw new Error("NTU COOL credentials are not configured for this user.");
  }

  if (!mailUsername || !mailPassword) {
    throw new Error("NTU Mail credentials are not configured for this user.");
  }

  return {
    coolUsername,
    coolPassword,
    mailUsername,
    mailPassword,
  };
}
