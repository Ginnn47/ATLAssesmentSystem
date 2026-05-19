const firstNames = [
  "Anya", "Kenji", "Mateo", "Sofia", "Liam", "Chloe", "Omar", "Fatima", "Kai", "Lena",
  "Hiroshi", "Isabella", "Javier", "Nadia", "Ethan", "Olivia", "Rohan", "Zara", "Noah", "Amelia"
];
const lastNames = [
  "Tanaka", "Rodriguez", "Schmidt", "Dubois", "Khan", "Kim", "Singh", "Müller", "Rossi", "Chen",
  "Suzuki", "Garcia", "Wagner", "Lefevre", "Ali", "Lee", "Patel", "Schneider", "Bianchi", "Wang"
];

const atlSkills = ["Thinking Skills", "Social Skills", "Communication", "Self-Management", "Research Skills"];
const avatarTones = [
  "from-amber-200 to-yellow-400", "from-cyan-200 to-cyan-400", "from-sky-200 to-blue-400",
  "from-stone-200 to-stone-300", "from-lime-200 to-lime-400", "from-blue-200 to-blue-400",
  "from-red-200 to-red-400", "from-green-200 to-green-400", "from-purple-200 to-purple-400",
  "from-orange-200 to-orange-400", "from-pink-200 to-pink-400", "from-teal-200 to-teal-400",
  "from-indigo-200 to-indigo-400", "from-yellow-200 to-yellow-400", "from-gray-200 to-gray-400"
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateRandomStudent = (id, kelas) => {
  const firstName = getRandomElement(firstNames);
  const lastName = getRandomElement(lastNames);
  const name = `${firstName} ${lastName}`;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`;
  const overall = getRandomNumber(40, 95);
  const strength = getRandomElement(atlSkills);
  let focus = getRandomElement(atlSkills);
  while (focus === strength) { // Ensure focus is different from strength
    focus = getRandomElement(atlSkills);
  }
  const trendValue = `${Math.random() > 0.5 ? '+' : '-'}${getRandomNumber(1, 10)}%`;

  return {
    id,
    name,
    nis: `NIS 202104${String(id).padStart(3, '0')}`,
    kelas,
    overall: `${overall}%`,
    strength,
    strengthValue: `${getRandomNumber(overall + 1, 100)}%`, // Strength usually higher than overall
    focus,
    trendValue,
    avatarTone: getRandomElement(avatarTones),
    initials,
  };
};

const existingStudents3A = [
  {
    id: 1,
    name: "Adzana Ashel Angelia",
    nis: "NIS 202104012",
    kelas: "3A",
    overall: "78%",
    strength: "Self-Management",
    strengthValue: "88%",
    focus: "Communication",
    trendValue: "+6%",
    avatarTone: "from-amber-200 to-yellow-400",
    initials: "AA",
  },
  {
    id: 2,
    name: "Budhi Nugroho",
    nis: "NIS 202104045",
    kelas: "3A",
    overall: "64%",
    strength: "Thinking Skills",
    strengthValue: "72%",
    focus: "Research Skills",
    trendValue: "-4%",
    avatarTone: "from-cyan-200 to-cyan-400",
    initials: "BN",
  },
  {
    id: 3,
    name: "Dewi Puspita Sari",
    nis: "NIS 202104088",
    kelas: "3A",
    overall: "82%",
    strength: "Thinking Skills",
    strengthValue: "90%",
    focus: "Self-Management",
    trendValue: "+8%",
    avatarTone: "from-sky-200 to-blue-400",
    initials: "DP",
  },
  {
    id: 4,
    name: "Fajar Setiawan",
    nis: "NIS 202104103",
    kelas: "3A",
    overall: "58%",
    strength: "Social Skills",
    strengthValue: "65%",
    focus: "Research Skills",
    trendValue: "-7%",
    avatarTone: "from-stone-200 to-stone-300",
    initials: "FS",
  },
  {
    id: 5,
    name: "Sheila Dara Aisha",
    nis: "NIS 202104129",
    kelas: "3A",
    overall: "85%",
    strength: "Self-Management",
        strengthValue: "92%",
    focus: "Communication",
    trendValue: "+5%",
    avatarTone: "from-lime-200 to-lime-400",
    initials: "SA",
  },
  { id: 6, name: "Lionel Messi", nis: "NIS 202104130", kelas: "3A", overall: "92%", strength: "Thinking Skills", strengthValue: "95%", focus: "Communication", trendValue: "+10%", avatarTone: "from-blue-200 to-blue-400", initials: "LM", },
  { id: 7, name: "Cristiano Ronaldo", nis: "NIS 202104131", kelas: "3A", overall: "88%", strength: "Self-Management", strengthValue: "90%", focus: "Social Skills", trendValue: "+7%", avatarTone: "from-red-200 to-red-400", initials: "CR", },
  { id: 8, name: "Neymar Jr", nis: "NIS 202104132", kelas: "3A", overall: "75%", strength: "Communication", strengthValue: "80%", focus: "Research Skills", trendValue: "+3%", avatarTone: "from-green-200 to-green-400", initials: "NJ", },
  { id: 9, name: "Kylian Mbappe", nis: "NIS 202104133", kelas: "3A", overall: "80%", strength: "Thinking Skills", strengthValue: "85%", focus: "Self-Management", trendValue: "+5%", avatarTone: "from-purple-200 to-purple-400", initials: "KM", },
  { id: 10, name: "Mohamed Salah", nis: "NIS 202104134", kelas: "3A", overall: "70%", strength: "Social Skills", strengthValue: "75%", focus: "Communication", trendValue: "+2%", avatarTone: "from-orange-200 to-orange-400", initials: "MS", },
  { id: 11, name: "Shani Indira Natio", nis: "NIS 202104135", kelas: "3A", overall: "90%", strength: "Self-Management", strengthValue: "93%", focus: "Thinking Skills", trendValue: "+8%", avatarTone: "from-pink-200 to-pink-400", initials: "SN", },
  { id: 12, name: "Indah Cahya Nabila", nis: "NIS 202104136", kelas: "3A", overall: "85%", strength: "Communication", strengthValue: "88%", focus: "Social Skills", trendValue: "+6%", avatarTone: "from-teal-200 to-teal-400", initials: "IC", },
  { id: 13, name: "Freya Jayawardana", nis: "NIS 202104137", kelas: "3A", overall: "78%", strength: "Research Skills", strengthValue: "82%", focus: "Self-Management", trendValue: "+4%", avatarTone: "from-indigo-200 to-indigo-400", initials: "FJ", },
  { id: 14, name: "Indira Putri Seruni", nis: "NIS 202104138", kelas: "3A", overall: "72%", strength: "Thinking Skills", strengthValue: "76%", focus: "Communication", trendValue: "+1%", avatarTone: "from-yellow-200 to-yellow-400", initials: "IS", },
  { id: 15, name: "Azezee Shafa ", nis: "NIS 202104139", kelas: "3A", overall: "68%", strength: "Social Skills", strengthValue: "70%", focus: "Research Skills", trendValue: "-2%", avatarTone: "from-gray-200 to-gray-400", initials: "AS", },
];

const generatedStudents4A = Array.from({ length: 10 }, (_, i) =>
  generateRandomStudent(i + 16, "4A") // Start IDs from 16
);

export const allStudentsData = {
  "3A - Primary": existingStudents3A,
  "4A - Primary": generatedStudents4A,
};