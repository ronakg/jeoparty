import { GameConfig } from '../types/game';

export const defaultGame: GameConfig = {
  title: 'Ultimate Trivia Championship',
  team1Name: 'Champions',
  team2Name: 'Challengers',
  defaultHintDeduction: 100,
  rounds: [
    {
      id: 'round-1',
      name: 'Jeopardy Round',
      categories: [
        {
          id: 'cat-1-1',
          name: 'WORLD GEOGRAPHY',
          clues: [
            {
              id: 'c-1-1-1',
              points: 100,
              question:
                'This European capital city is famously divided into Buda and Pest by the Danube River.',
              answer: 'Budapest',
              hint: 'Capital of Hungary.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-2',
              points: 200,
              question:
                'Spanning 11 time zones, this country is the largest in the world by land area.',
              answer: 'Russia',
              hint: 'Extends from Eastern Europe to the Pacific Ocean.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-3',
              points: 300,
              question:
                'This high-altitude South American lake sits along the border between Peru and Bolivia.',
              answer: 'Lake Titicaca',
              hint: 'Highest navigable lake in the world.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-4',
              points: 400,
              question:
                'What African country is completely surrounded by South Africa?',
              answer: 'Lesotho',
              hint: 'Known as the Kingdom in the Sky.',
              state: 'unopened',
            },
            {
              id: 'c-1-1-5',
              points: 500,
              question:
                'This narrow body of water separates the island of Sumatra from the Malay Peninsula.',
              answer: 'Strait of Malacca',
              hint: 'One of the most important shipping waterways in world trade.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-2',
          name: 'SCIENCE & NATURE',
          clues: [
            {
              id: 'c-1-2-1',
              points: 100,
              question:
                "This gas makes up approximately 78% of the Earth's atmosphere.",
              answer: 'Nitrogen',
              hint: 'Its chemical symbol is N.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-2',
              points: 200,
              question:
                'What is the only mammal naturally capable of sustained, powered flight?',
              answer: 'The Bat',
              hint: 'Nocturnal creature with echolocation.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-3',
              points: 300,
              question:
                'Often called the powerhouse of the cell, this organelle generates most chemical energy.',
              answer: 'Mitochondria',
              hint: 'Produces ATP.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-4',
              points: 400,
              question:
                "Discovered by Alexander Fleming in 1928, this was the world's first widely effective antibiotic.",
              answer: 'Penicillin',
              hint: 'Derived from a common mold genus.',
              state: 'unopened',
            },
            {
              id: 'c-1-2-5',
              points: 500,
              question:
                'In physics, what term describes a substance changing directly from a solid to a gas without melting?',
              answer: 'Sublimation',
              hint: 'Dry ice (solid CO2) demonstrates this at room temperature.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-3',
          name: 'BOLLYWOOD & CINEMA',
          clues: [
            {
              id: 'c-1-3-1',
              points: 100,
              question:
                "Identify this legendary actor and 'King of Bollywood' shown here with his signature sunglasses.",
              answer: 'Shah Rukh Khan (SRK)',
              hint: "Star of 'Dilwale Dulhania Le Jayenge', 'Chennai Express', 'Pathaan', and 'Jawan'.",
              media: {
                type: 'image',
                urlOrPath: 'resources/images (3).jpeg',
              },
              state: 'unopened',
            },
            {
              id: 'c-1-3-2',
              points: 200,
              question:
                "Name this Bollywood leading actress who debuted in 'Om Shanti Om' and starred in 'Padmaavat' and 'Piku'.",
              answer: 'Deepika Padukone',
              hint: "Also featured in Hollywood's 'xXx: Return of Xander Cage' and married to Ranveer Singh.",
              media: {
                type: 'image',
                urlOrPath: 'resources/images (2).jpeg',
              },
              state: 'unopened',
            },
            {
              id: 'c-1-3-3',
              points: 300,
              question:
                "Recognize this charismatic actor acclaimed for roles in 'Haider', 'Jab We Met', and 'Kabir Singh'.",
              answer: 'Shahid Kapoor',
              hint: "Son of veteran actor Pankaj Kapur, also starred in the streaming series 'Farzi'.",
              media: {
                type: 'image',
                urlOrPath: 'resources/images.jpeg',
              },
              state: 'unopened',
            },
            {
              id: 'c-1-3-4',
              points: 400,
              question:
                "Identify this leading actress who portrayed the warrior Avanthika in 'Baahubali: The Beginning'.",
              answer: 'Tamannaah Bhatia',
              hint: "Star of viral chartbusters 'Kaavaalaa' in 'Jailer' and 'Aaj Ki Raat' in 'Stree 2'.",
              media: {
                type: 'image',
                urlOrPath: 'resources/images (1).jpeg',
              },
              state: 'unopened',
            },
            {
              id: 'c-1-3-5',
              points: 500,
              question:
                'Watch this video clip: What 1985 sci-fi film features a time-traveling DeLorean?',
              answer: 'Back to the Future',
              hint: 'Starring Michael J. Fox and Christopher Lloyd.',
              media: {
                type: 'youtube',
                urlOrPath: 'https://www.youtube.com/watch?v=qvsgGtivCgs',
              },
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-4',
          name: 'FOOD & DRINK',
          clues: [
            {
              id: 'c-1-4-1',
              points: 100,
              question:
                'Traditional Japanese wasabi is made from the rhizome of a plant in what vegetable family?',
              answer: 'Mustard (or Cabbage / Brassicaceae / Horseradish)',
              hint: 'Known for pungent sharp heat rather than chili peppers.',
              state: 'unopened',
            },
            {
              id: 'c-1-4-2',
              points: 200,
              question:
                "Which country is the birthplace of the popular cocktail 'Caipirinha', made with cachaça?",
              answer: 'Brazil',
              hint: "South America's largest Portuguese-speaking nation.",
              state: 'unopened',
            },
            {
              id: 'c-1-4-3',
              points: 300,
              question:
                'What precious spice, collected by hand from crocus flower stigmas, is considered the most expensive by weight?',
              answer: 'Saffron',
              hint: 'Gives paella and risotto alla Milanese their vibrant golden hue.',
              state: 'unopened',
            },
            {
              id: 'c-1-4-4',
              points: 400,
              question:
                'Roquefort cheese must be aged in the natural caves of Combalou in this country.',
              answer: 'France',
              hint: "Famous blue sheep's-milk cheese.",
              state: 'unopened',
            },
            {
              id: 'c-1-4-5',
              points: 500,
              question:
                'What yeast extract spread originated in Australia in 1922 and is commonly spread on buttered toast?',
              answer: 'Vegemite',
              hint: "Made from leftover brewer's yeast.",
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-1-5',
          name: 'TECH & INNOVATION',
          clues: [
            {
              id: 'c-1-5-1',
              points: 100,
              question: "In computer science, what does 'CPU' stand for?",
              answer: 'Central Processing Unit',
              hint: 'Often referred to as the brains of a computer.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-2',
              points: 200,
              question:
                'What programming language created by Brendan Eich in 1995 was originally codenamed Mocha?',
              answer: 'JavaScript',
              hint: 'The fundamental language running the interactive web.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-3',
              points: 300,
              question:
                'In 1969, the first transmission between computers occurred over what precursor network to the Internet?',
              answer: 'ARPANET',
              hint: 'Funded by the US Department of Defense.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-4',
              points: 400,
              question:
                'What term coined in 1950 by Alan Turing tests whether a machine can exhibit human-equivalent intelligence?',
              answer: 'The Turing Test (The Imitation Game)',
              hint: 'Named after the English mathematician and codebreaker.',
              state: 'unopened',
            },
            {
              id: 'c-1-5-5',
              points: 500,
              question:
                'What is the name of the open-source Linux kernel mascot created by Larry Ewing in 1996?',
              answer: 'Tux (The Penguin)',
              hint: 'A cheerful aquatic bird sitting down.',
              state: 'unopened',
            },
          ],
        },
      ],
    },
    {
      id: 'round-2',
      name: 'Double Jeopardy',
      categories: [
        {
          id: 'cat-2-1',
          name: 'ANCIENT HISTORY',
          clues: [
            {
              id: 'c-2-1-1',
              points: 200,
              question:
                'Which Egyptian queen was the last active ruler of the Ptolemaic Kingdom of Egypt?',
              answer: 'Cleopatra (Cleopatra VII)',
              hint: 'Had relationships with Julius Caesar and Mark Antony.',
              state: 'unopened',
            },
            {
              id: 'c-2-1-2',
              points: 400,
              question:
                'The ancient city of Carthage was located in the territory of what modern-day North African nation?',
              answer: 'Tunisia',
              hint: 'Home to the Punic Wars adversary Hannibal.',
              state: 'unopened',
            },
            {
              id: 'c-2-1-3',
              points: 600,
              question:
                'Which Babylonian king is renowned for one of the earliest written legal codes, inscribed on stone steles?',
              answer: 'Hammurabi',
              hint: "Often summarized by the phrase 'an eye for an eye'.",
              state: 'unopened',
            },
            {
              id: 'c-2-1-4',
              points: 800,
              question:
                'In 480 BC, Spartan King Leonidas led Greek forces against the Persians at what narrow mountain pass?',
              answer: 'Thermopylae',
              hint: 'The famous battle of the 300 Spartans.',
              state: 'unopened',
            },
            {
              id: 'c-2-1-5',
              points: 1000,
              question:
                "Which Roman emperor was the philosopher who wrote the Stoic work 'Meditations' while campaigning?",
              answer: 'Marcus Aurelius',
              hint: "The last of the so-called 'Five Good Emperors'.",
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-2-2',
          name: 'LITERATURE & POETRY',
          clues: [
            {
              id: 'c-2-2-1',
              points: 200,
              question:
                "Which Herman Melville novel opens with the iconic sentence: 'Call me Ishmael'?",
              answer: 'Moby-Dick',
              hint: 'Centers on Captain Ahab and a legendary white whale.',
              state: 'unopened',
            },
            {
              id: 'c-2-2-2',
              points: 400,
              question:
                "In Dante's 'Divine Comedy', which Roman poet guides Dante through Hell and Purgatory?",
              answer: 'Virgil',
              hint: "Author of the 'Aeneid'.",
              state: 'unopened',
            },
            {
              id: 'c-2-2-3',
              points: 600,
              question:
                'Mary Shelley conceived this gothic masterpiece during a rainy summer in Switzerland in 1816.',
              answer: 'Frankenstein (The Modern Prometheus)',
              hint: "Subtitled 'The Modern Prometheus'.",
              state: 'unopened',
            },
            {
              id: 'c-2-2-4',
              points: 800,
              question:
                "Which 19th-century Russian author penned both 'War and Peace' and 'Anna Karenina'?",
              answer: 'Leo Tolstoy',
              hint: 'Count who later advocated Christian anarchism and pacifism.',
              state: 'unopened',
            },
            {
              id: 'c-2-2-5',
              points: 1000,
              question:
                "Who wrote the line: 'Water, water, everywhere, / Nor any drop to drink' in 'The Rime of the Ancient Mariner'?",
              answer: 'Samuel Taylor Coleridge',
              hint: 'English Romantic poet and friend of William Wordsworth.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-2-3',
          name: 'MUSICAL MASTERS',
          clues: [
            {
              id: 'c-2-3-1',
              points: 200,
              question:
                "Which Austrian prodigy composed 'The Magic Flute' and completed over 600 works before dying at age 35?",
              answer: 'Wolfgang Amadeus Mozart',
              hint: 'First name is Wolfgang.',
              state: 'unopened',
            },
            {
              id: 'c-2-3-2',
              points: 400,
              question:
                'Beethoven famously dedicated his Symphony No. 3 (Eroica) to what military figure before angrily tearing up the dedication?',
              answer: 'Napoleon Bonaparte',
              hint: 'Became Emperor of the French in 1804.',
              state: 'unopened',
            },
            {
              id: 'c-2-3-3',
              points: 600,
              question:
                "Which British rock band recorded the 1973 album 'The Dark Side of the Moon'?",
              answer: 'Pink Floyd',
              hint: 'Featuring Roger Waters and David Gilmour.',
              state: 'unopened',
            },
            {
              id: 'c-2-3-4',
              points: 800,
              question:
                "What Polish-French Romantic composer was known as the 'Poet of the Piano' and composed dozens of Nocturnes?",
              answer: 'Frédéric Chopin',
              hint: 'Buried in Paris, with his heart entombed in Warsaw.',
              state: 'unopened',
            },
            {
              id: 'c-2-3-5',
              points: 1000,
              question:
                "Which 20th-century Russian composer caused a riot in Paris at the 1913 premiere of his ballet 'The Rite of Spring'?",
              answer: 'Igor Stravinsky',
              hint: 'Famous for revolutionary rhythm and polytonality.',
              state: 'unopened',
            },
          ],
        },
        {
          id: 'cat-2-4',
          name: 'SPACE EXPLORATION',
          clues: [
            {
              id: 'c-2-4-1',
              points: 200,
              question:
                'In 1961, who became the first human in space aboard the Vostok 1 spacecraft?',
              answer: 'Yuri Gagarin',
              hint: 'Soviet cosmonaut.',
              state: 'unopened',
            },
            {
              id: 'c-2-4-2',
              points: 400,
              question:
                'Which NASA space telescope launched on Christmas Day 2021 to observe the universe in high-resolution infrared?',
              answer: 'James Webb Space Telescope (JWST)',
              hint: 'Located at the Sun-Earth L2 Lagrange point.',
              state: 'unopened',
            },
            {
              id: 'c-2-4-3',
              points: 600,
              question:
                'Which moon of Saturn is known for geysers of water vapor erupting from its south polar fractures?',
              answer: 'Enceladus',
              hint: 'Has a global subsurface ocean beneath an icy crust.',
              state: 'unopened',
            },
            {
              id: 'c-2-4-4',
              points: 800,
              question:
                'What is the boundary around a black hole beyond which nothing, not even light, can escape?',
              answer: 'Event Horizon',
              hint: 'Calculated by the Schwarzschild radius.',
              state: 'unopened',
            },
            {
              id: 'c-2-4-5',
              points: 1000,
              question:
                'Launched in 1977, which probe officially became the first human-made object to cross into interstellar space in 2012?',
              answer: 'Voyager 1',
              hint: 'Carries the Golden Record.',
              state: 'unopened',
            },
          ],
        },
      ],
    },
  ],
  finalJeopardy: {
    category: 'FAMOUS LANDMARKS',
    question:
      "Engineered for the 1889 Exposition Universelle, this wrought-iron structure was originally criticized as a 'black and gigantic factory chimney'.",
    answer: 'The Eiffel Tower (Tour Eiffel)',
    hint: 'Located on the Champ de Mars in Paris.',
  },
};
