import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000)
}

function parseTime(str, baseDate) {
  const [h, m] = str.split(':').map(Number)
  const d = new Date(baseDate)
  d.setHours(h, m, 0, 0)
  return d
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

async function main() {
  console.log('🌱 Starting seed…')

  // Course settings
  await prisma.courseSettings.upsert({
    where:  { id: 'singleton' },
    update: {},
    create: {
      publicBookingDays:   7,
      memberBookingDays:   14,
      pricePerPlayerCents: 4500,
      firstTeeTime:        '07:30',
      lastTeeTime:         '17:00',
      intervalMinutes:     10,
    },
  })
  console.log('✅ Course settings seeded')

  // Tee time slots for the next 30 days
  const settings = await prisma.courseSettings.findUnique({ where: { id: 'singleton' } })
  const today    = new Date()
  today.setHours(0, 0, 0, 0)
  let slotsCreated = 0

  for (let i = 0; i < 30; i++) {
    const date     = addDays(today, i)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    let current    = parseTime(settings.firstTeeTime, dateOnly)
    const last     = parseTime(settings.lastTeeTime, dateOnly)

    while (current <= last) {
      const timeStr = formatTime(current)
      await prisma.teeTimeSlot.upsert({
        where:  { date_startTime: { date: dateOnly, startTime: timeStr } },
        update: {},
        create: { date: dateOnly, startTime: timeStr, maxPlayers: 4, memberOnly: false },
      })
      slotsCreated++
      current = addMinutes(current, settings.intervalMinutes)
    }
  }
  console.log(`✅ ${slotsCreated} tee time slots seeded`)

  // Tournament events
  const eventsData = [
    {
      name:        'Spring Opener Scramble',
      description: 'Kick off the season with Deer Run\'s annual Spring Opener. Four-person teams, best-ball format. Prizes for all flight winners.',
      eventDate:   new Date('2025-03-22'),
      startTime:   '8:00 AM',
      format:      '4-Person Scramble',
      entry:       2500,
      spotsTotal:  null,
      memberOnly:  false,
      featured:    true,
      past:        false,
    },
    {
      name:        'Member Invitational',
      description: 'Annual member-only invitational with individual stroke play. Low gross and net winners in two flights.',
      eventDate:   new Date('2025-04-12'),
      startTime:   '7:30 AM',
      format:      'Individual Stroke',
      entry:       1500,
      spotsTotal:  null,
      memberOnly:  true,
      featured:    false,
      past:        false,
    },
    {
      name:        'Lawrence County Charity Open',
      description: 'Benefiting the Lawrence County Boys & Girls Club. Two-person best ball. Includes cookout lunch, silent auction, and prizes.',
      eventDate:   new Date('2025-05-17'),
      startTime:   '9:00 AM',
      format:      'Best Ball',
      entry:       5000,
      spotsTotal:  80,
      memberOnly:  false,
      featured:    true,
      past:        false,
    },
    {
      name:        'Junior Summer Classic',
      description: 'Annual junior tournament open to all youth golfers. Multiple age divisions. Parent / junior division available.',
      eventDate:   new Date('2025-06-07'),
      startTime:   '8:00 AM',
      format:      'Individual Stroke',
      entry:       1000,
      spotsTotal:  null,
      memberOnly:  false,
      featured:    false,
      past:        false,
    },
    {
      name:        'Independence Day Scramble',
      description: 'Celebrate the 4th on the fairways. Three-person scramble, cookout included with registration.',
      eventDate:   new Date('2025-07-04'),
      startTime:   '7:30 AM',
      format:      '3-Person Scramble',
      entry:       2000,
      spotsTotal:  36,
      memberOnly:  false,
      featured:    false,
      past:        false,
    },
    {
      name:        'Fall Member Classic',
      description: 'End-of-season member event using Stableford scoring. Fall foliage along the Bankhead Forest makes this round one of the most scenic.',
      eventDate:   new Date('2025-09-20'),
      startTime:   '8:00 AM',
      format:      'Stableford',
      entry:       null,
      spotsTotal:  null,
      memberOnly:  true,
      featured:    false,
      past:        false,
    },
    {
      name:        'New Year Scramble',
      description: 'Sold-out field of 120 players. Congratulations to Team Parker for their -14 winning score.',
      eventDate:   new Date('2025-01-18'),
      startTime:   '10:00 AM',
      format:      '4-Person Scramble',
      entry:       2000,
      spotsTotal:  null,
      memberOnly:  false,
      featured:    false,
      past:        true,
    },
    {
      name:        "Valentine's Day Couples",
      description: 'Mixed couples best-ball format — 28 teams competed. Overall winners: John & Sarah Whitfield with a -8 round.',
      eventDate:   new Date('2025-02-15'),
      startTime:   '9:00 AM',
      format:      'Best Ball',
      entry:       3000,
      spotsTotal:  null,
      memberOnly:  false,
      featured:    false,
      past:        true,
    },
  ]

  // Only seed if no events exist yet
  const existing = await prisma.tournamentEvent.count()
  if (existing === 0) {
    await prisma.tournamentEvent.createMany({ data: eventsData })
    console.log(`✅ ${eventsData.length} tournament events seeded`)
  } else {
    console.log(`ℹ️  Events already exist, skipping`)
  }

  console.log('✅ Seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
