import { GameConfig } from '../types/game';

export const maxSampleGame: GameConfig = {
  title: 'Grand Championship (Max 7x8)',
  team1Name: 'Titans',
  team2Name: 'Vanguard',
  defaultHintDeduction: 100,
  reboundPercentage: 50,
  pointProgression: [100, 200, 300, 400, 500, 600, 700, 800],
  questionTimerSeconds: 60,
  rounds: [
    {
      id: 'round-1',
      name: 'Jeopardy Round',
      categories: [
        {
          id: 'cat-1-1',
          name: 'SCIENCE & DISCOVERY',
          clues: [
            {
              id: 'c-1-1-1',
              points: 100,
              question:
                'Which subatomic particle carries a negative electric charge?',
              answer: 'Electron',
              hint: 'Orbits the atomic nucleus.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-2',
              points: 200,
              question:
                'What human organ consumes roughly 20 percent of total ' +
                'energy?',
              answer: 'Brain',
              hint: 'The central command hub of the nervous system.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-3',
              points: 300,
              question:
                'What fundamental force keeps planets in orbit around the Sun?',
              answer: 'Gravity',
              hint:
                'Formulated by Isaac Newton and later expanded by Albert ' +
                'Einstein.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-4',
              points: 400,
              question:
                "What gas accounts for roughly 78 percent of Earth's " +
                'atmosphere?',
              answer: 'Nitrogen',
              hint: 'Chemical symbol N, atomic number 7.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-5',
              points: 500,
              question:
                'What process do plants use to transform sunlight into ' +
                'chemical energy?',
              answer: 'Photosynthesis',
              hint: 'Takes place primarily within chloroplasts.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-6',
              points: 600,
              question:
                'Which scientist formulated the three laws of motion in ' +
                'Principia?',
              answer: 'Sir Isaac Newton',
              hint: 'Published in 1687, foundational to classical mechanics.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-7',
              points: 700,
              question:
                "What is the rarest naturally occurring element in Earth's " +
                'crust?',
              answer: 'Astatine',
              hint: 'A radioactive halogen with atomic number 85.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-8',
              points: 800,
              question:
                'What astronomical boundary marks the point of no return for ' +
                'a black hole?',
              answer: 'Event Horizon',
              hint:
                'Beyond this threshold, not even light can escape ' +
                'gravitational pull.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-2',
          name: 'WORLD HISTORY',
          clues: [
            {
              id: 'c-1-2-1',
              points: 100,
              question:
                'Which ancient civilization constructed the Great Pyramids ' +
                'of Giza?',
              answer: 'Ancient Egypt',
              hint: 'Flourished along the banks of the Nile River.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-2',
              points: 200,
              question:
                'In what year did the Apollo 11 mission land humans on the ' +
                'Moon?',
              answer: '1969',
              hint:
                'Commander Neil Armstrong stepped onto lunar soil in July.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-3',
              points: 300,
              question:
                'Which Roman general was assassinated on the Ides of March ' +
                'in 44 BC?',
              answer: 'Julius Caesar',
              hint:
                'His assassination catalyzed the collapse of the Roman ' +
                'Republic.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-4',
              points: 400,
              question:
                'What barrier dividing an East and West European city fell ' +
                'in 1989?',
              answer: 'Berlin Wall',
              hint: 'Symbolized the Cold War division of post-war Germany.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-5',
              points: 500,
              question:
                'Which queen ruled England during the defeat of the Spanish ' +
                'Armada in 1588?',
              answer: 'Queen Elizabeth I',
              hint: 'The daughter of Henry VIII and Anne Boleyn.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-6',
              points: 600,
              question:
                'What maritime republic dominated Mediterranean trade from ' +
                'the Adriatic?',
              answer: 'Republic of Venice',
              hint: 'Governed by an elected Doge for more than a millennium.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-7',
              points: 700,
              question:
                'In what year did English barons force King John to grant ' +
                'Magna Carta?',
              answer: '1215',
              hint: 'Signed at Runnymede near Windsor.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-8',
              points: 800,
              question:
                'Which empire founded Tenochtitlan on Lake Texcoco in 1325?',
              answer: 'Aztec Empire',
              hint: 'Conquered by Hernan Cortes in 1521.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-3',
          name: 'GEOGRAPHY & TRAVEL',
          clues: [
            {
              id: 'c-1-3-1',
              points: 100,
              question:
                'What is the largest ocean on Earth by surface area and ' +
                'volume?',
              answer: 'Pacific Ocean',
              hint: 'Covers more than 30 percent of the planetary surface.',
              state: 'unopened',
            },
            {
              id: 'c-1-3-2',
              points: 200,
              question:
                'What is the longest river on the South American continent?',
              answer: 'Amazon River',
              hint:
                'Carries more water than any other river system in the world.',
              state: 'unopened',
            },
            {
              id: 'c-1-3-3',
              points: 300,
              question:
                'What mountain range forms the traditional boundary ' +
                'between Europe and Asia?',
              answer: 'Ural Mountains',
              hint:
                'Extends from the Arctic Ocean to Kazakhstan through Russia.',
              state: 'unopened',
            },
            {
              id: 'c-1-3-4',
              points: 400,
              question:
                'What city serves as the planned federal capital of Australia?',
              answer: 'Canberra',
              hint:
                'Located in the Capital Territory between Sydney and ' +
                'Melbourne.',
              state: 'unopened',
            },
            {
              id: 'c-1-3-5',
              points: 500,
              question:
                'What narrow strait connects the Mediterranean Sea to the ' +
                'Atlantic Ocean?',
              answer: 'Strait of Gibraltar',
              hint: 'Flanked historically by the Pillars of Hercules.',
              state: 'unopened',
            },
            {
              id: 'c-1-3-6',
              points: 600,
              question:
                'Which island nation south of India was historically known ' +
                'as Ceylon?',
              answer: 'Sri Lanka',
              hint: 'Gained independence from British rule in 1948.',
              state: 'unopened',
            },
            {
              id: 'c-1-3-7',
              points: 700,
              question:
                'What vast landlocked nation in Central Asia is ' +
                'ninth-largest by area?',
              answer: 'Kazakhstan',
              hint:
                'Stretches from the Caspian Sea to the Altai Mountains.',
              state: 'unopened',
            },
            {
              id: 'c-1-3-8',
              points: 800,
              question:
                'What Norwegian archipelago in the Arctic Ocean houses the ' +
                'Seed Vault?',
              answer: 'Svalbard',
              hint:
                'Situated roughly midway between mainland Norway and the ' +
                'North Pole.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-4',
          name: 'LITERATURE & ARTS',
          clues: [
            {
              id: 'c-1-4-1',
              points: 100,
              question:
                'Who wrote the Elizabethan tragic drama Romeo and Juliet?',
              answer: 'William Shakespeare',
              hint: 'English celebrated poet known as the Bard of Avon.',
              state: 'unopened',
            },
            {
              id: 'c-1-4-2',
              points: 200,
              question:
                'Which Italian polymath painted the Mona Lisa and The Last ' +
                'Supper?',
              answer: 'Leonardo da Vinci',
              hint: 'Florentine master of the High Renaissance.',
              state: 'unopened',
            },
            {
              id: 'c-1-4-3',
              points: 300,
              question:
                'In Herman Melville novel, what sea creature is pursued by ' +
                'Ahab?',
              answer: 'White Sperm Whale',
              hint: 'Gives its name to the title of the book.',
              state: 'unopened',
            },
            {
              id: 'c-1-4-4',
              points: 400,
              question:
                'Which French novelist wrote the 19th-century epic Les ' +
                'Miserables?',
              answer: 'Victor Hugo',
              hint: 'Also authored The Hunchback of Notre-Dame.',
              state: 'unopened',
            },
            {
              id: 'c-1-4-5',
              points: 500,
              question:
                'What literary role is defined as the principal adversary to ' +
                'the hero?',
              answer: 'Antagonist',
              hint: 'Provides the central conflict opposing the protagonist.',
              state: 'unopened',
            },
            {
              id: 'c-1-4-6',
              points: 600,
              question:
                'Who created The Starry Night while residing at an asylum in ' +
                'Saint-Remy?',
              answer: 'Vincent van Gogh',
              hint:
                'Post-Impressionist master known for swirling brushstrokes.',
              state: 'unopened',
            },
            {
              id: 'c-1-4-7',
              points: 700,
              question:
                'Which medieval epic poem recounts the deeds of Spanish ' +
                'hero El Cid?',
              answer: 'Cantar de mio Cid',
              hint: 'Oldest preserved Spanish epic cantares de gesta.',
              state: 'unopened',
            },
            {
              id: 'c-1-4-8',
              points: 800,
              question:
                'Which Roman poet guides Dante through Inferno in the ' +
                'Divine Comedy?',
              answer: 'Virgil',
              hint: 'Author of the ancient Roman epic poem the Aeneid.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-5',
          name: 'POP CULTURE & CINEMA',
          clues: [
            {
              id: 'c-1-5-1',
              points: 100,
              question:
                'What 1977 galactic sci-fi film introduced Luke Skywalker ' +
                'and Han Solo?',
              answer: 'Star Wars: A New Hope',
              hint: 'Directed and created by George Lucas.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-2',
              points: 200,
              question:
                'What British quartet recorded Abbey Road and Sgt. Pepper ' +
                'albums?',
              answer: 'The Beatles',
              hint:
                'Rock band formed in Liverpool featuring Lennon and ' +
                'McCartney.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-3',
              points: 300,
              question:
                'Who directed blockbuster classics Jurassic Park, Jaws, and ' +
                'E.T.?',
              answer: 'Steven Spielberg',
              hint:
                'Co-founded DreamWorks Pictures and won multiple Academy ' +
                'Awards.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-4',
              points: 400,
              question:
                'What fictional metal is bonded to the skeletal claws of ' +
                'Wolverine?',
              answer: 'Adamantium',
              hint:
                'Virtually indestructible comic alloy created in Marvel lore.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-5',
              points: 500,
              question:
                'Which actress portrayed tribute Katniss Everdeen in The ' +
                'Hunger Games?',
              answer: 'Jennifer Lawrence',
              hint: 'Also won an Academy Award for Silver Linings Playbook.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-6',
              points: 600,
              question:
                'What 1994 neo-noir Tarantino film stars Travolta and Samuel ' +
                'Jackson?',
              answer: 'Pulp Fiction',
              hint: 'Won the Palme d Or at the Cannes Film Festival.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-7',
              points: 700,
              question:
                'What 1993 stop-motion holiday musical features Jack ' +
                'Skellington?',
              answer: 'The Nightmare Before Christmas',
              hint:
                'Conceived and produced by Tim Burton, directed by Henry ' +
                'Selick.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-8',
              points: 800,
              question:
                'Which British intelligence agent was created by Ian Fleming ' +
                'in 1953?',
              answer: 'James Bond (007)',
              hint: 'Debuted in the espionage novel Casino Royale.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-6',
          name: 'SPORTS & GAMES',
          clues: [
            {
              id: 'c-1-6-1',
              points: 100,
              question:
                'In soccer (association football), how many players per side ' +
                'start on pitch?',
              answer: '11',
              hint: 'Ten outfield players and one goalkeeper.',
              state: 'unopened',
            },
            {
              id: 'c-1-6-2',
              points: 200,
              question:
                'What sport awards scores named birdie, eagle, and albatross?',
              answer: 'Golf',
              hint: 'Played with clubs over a course of 9 or 18 holes.',
              state: 'unopened',
            },
            {
              id: 'c-1-6-3',
              points: 300,
              question:
                'How many total squares make up a standard international ' +
                'chessboard?',
              answer: '64',
              hint:
                'Arranged in an eight-by-eight grid of contrasting colors.',
              state: 'unopened',
            },
            {
              id: 'c-1-6-4',
              points: 400,
              question:
                'Which national team has captured the most FIFA Men World ' +
                'Cup titles?',
              answer: 'Brazil',
              hint: 'Five-time world champions celebrated for Jogo Bonito.',
              state: 'unopened',
            },
            {
              id: 'c-1-6-5',
              points: 500,
              question:
                'In lawn tennis, what term describes a tied score of 40-40 ' +
                'in a game?',
              answer: 'Deuce',
              hint:
                'Requires two consecutive vantage points to close the game.',
              state: 'unopened',
            },
            {
              id: 'c-1-6-6',
              points: 600,
              question:
                'Which city hosted the inaugural modern Olympic Games in ' +
                '1896?',
              answer: 'Athens, Greece',
              hint:
                'Revived Pierre de Coubertin vision in the Panathenaic ' +
                'Stadium.',
              state: 'unopened',
            },
            {
              id: 'c-1-6-7',
              points: 700,
              question:
                'What is the highest achievable single-game score in ' +
                'ten-pin bowling?',
              answer: '300',
              hint: 'Achieved by rolling twelve strikes in succession.',
              state: 'unopened',
            },
            {
              id: 'c-1-6-8',
              points: 800,
              question:
                'Which Spanish cyclist won five consecutive Tour de France ' +
                'titles in 1990s?',
              answer: 'Miguel Indurain',
              hint: 'Dominated the Grand Tour from 1991 through 1995.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-7',
          name: 'FOOD & CUISINE',
          clues: [
            {
              id: 'c-1-7-1',
              points: 100,
              question:
                'What fruit serves as the creamy foundation of traditional ' +
                'guacamole?',
              answer: 'Avocado',
              hint: 'Botanically a large berry containing a single seed.',
              state: 'unopened',
            },
            {
              id: 'c-1-7-2',
              points: 200,
              question:
                'What viscous sweetener is manufactured by bees utilizing ' +
                'floral nectar?',
              answer: 'Honey',
              hint:
                'Low moisture and high acidity allow it to remain edible ' +
                'indefinitely.',
              state: 'unopened',
            },
            {
              id: 'c-1-7-3',
              points: 300,
              question:
                'Which Genoese pasta sauce combines fresh basil, pine nuts, ' +
                'garlic, and oil?',
              answer: 'Pesto',
              hint: 'Traditionally ground using a mortar and pestle.',
              state: 'unopened',
            },
            {
              id: 'c-1-7-4',
              points: 400,
              question:
                'What Japanese fermented soybean paste flavours ' +
                'traditional soup broth?',
              answer: 'Miso',
              hint:
                'Produced by fermenting soybeans with salt and koji fungus.',
              state: 'unopened',
            },
            {
              id: 'c-1-7-5',
              points: 500,
              question:
                'What spice derived from Crocus sativus is the most ' +
                'expensive by weight?',
              answer: 'Saffron',
              hint:
                'Hand-harvested crimson stigmas yield distinct aroma and ' +
                'golden hue.',
              state: 'unopened',
            },
            {
              id: 'c-1-7-6',
              points: 600,
              question:
                'Which classic French mother sauce consists of white roux ' +
                'and milk?',
              answer: 'Bechamel',
              hint:
                'Forms the creamy base for Mornay and white pasta sauces.',
              state: 'unopened',
            },
            {
              id: 'c-1-7-7',
              points: 700,
              question:
                'What Apulian cheese features mozzarella exterior filled ' +
                'with stracciatella?',
              answer: 'Burrata',
              hint: 'Heart filled with mozzarella shreds and fresh cream.',
              state: 'unopened',
            },
            {
              id: 'c-1-7-8',
              points: 800,
              question:
                'What premium Spanish cured ham comes from acorn-fed Iberian ' +
                'black pigs?',
              answer: 'Jamon Iberico de Bellota',
              hint: 'Cured for up to four years in mountain cellars.',
              state: 'unopened',
            },
          ],
        },
      ],
    },
  ],
  finalJeopardy: {
    category: 'ASTRONOMY & COSMOLOGY',
    question:
      'First detected in 1967, what magnetized neutron star emits regular ' +
      'pulses?',
    answer: 'Pulsar',
    hint: 'Discovered by astrophysicist Jocelyn Bell Burnell.',
  },
};
