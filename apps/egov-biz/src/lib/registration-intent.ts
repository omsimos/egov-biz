const BUSINESS_DESCRIPTION =
  /\b(business|company|shop|store|clinic|practice|restaurant|bakery|cafe|coffee|food|catering|dental|dentist|medical|doctor|consulting|consultant|freelanc(?:e|er|ing)|virtual assistant|va|designer|developer|photograph|accounting|retail|rental|salon|laundry|agency|sole propriet|corporation|partnership)\b/i;

export function describesBusinessIdea(prompt: string) {
  return (
    BUSINESS_DESCRIPTION.test(prompt) ||
    /\b(?:sell|selling|offer|offering|provide|providing)\b.{0,50}\b(?:service|services|product|products|food|drinks|online)\b/i.test(
      prompt,
    )
  );
}

export function isRegistrationStart(prompt: string) {
  const action = /\b(start|open|launch|set\s*up|establish|register|formalize|apply|create)\b/i.test(
    prompt,
  );
  const subject =
    /\b(business|company|shop|store|clinic|practice|restaurant|bakery|cafe|service|freelanc(?:e|er|ing)|virtual assistant|va|sole propriet|corporation|partnership|permit|registration)\b/i.test(
      prompt,
    );
  return action && subject;
}
