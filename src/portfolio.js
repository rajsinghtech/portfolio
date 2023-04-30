const header = {
  // all the properties are optional - can be left empty or deleted
  homepage: 'https://rajsinghtech.github.io/',
  title: 'Raj Singh.',
}

const about = {
  // all the properties are optional - can be left empty or deleted
  name: 'Raj Singh',
  role: 'Site Reliability Engineer',
  description:
    'Looking for a challenging position in an IT Company that will utilize my expertise to contribute to the growth of the organization. I have a passion for networking infrastructure, platform engineering, and integrated systems.',
  resume: 'https://rajsinghtech.github.io/',
  social: {
    linkedin: 'https://www.linkedin.com/in/rajsingh360/',
    github: 'https://github.com/rajsinghtech',
  },
}

const projects = [
  // projects can be added an removed
  // if there are no projects, Projects section won't show up
  {
    name: 'Okta Sidecar',
    description:
      'Created a sidecar container to allow for the use of Okta SSO with any application in a containerized environment. This was done by using the Okta API to generate a JWT token and then using that token to authenticate with the application.',
    stack: ['Nginx', 'Docker', 'Kubernetes', 'Oauth', 'Okta'],
    sourceCode: 'https://github.com/rajsinghtech/Okta-Sidecar',
    livePreview: 'https://github.com/rajsinghtech/Okta-Sidecar',
  },
  {
    name: 'Twitter Bot ETF Tracker',
    description:
      'Created a twitter bot to track the performance of ETFs. This was done by scrapping the various position sizings of an ETF and then using that to calculate the day to day change of the ETF.',
    stack: ['Python', 'SQL'],
    sourceCode: 'https://github.com/rajsinghtech/pptracker',
    livePreview: 'https://twitter.com/LongPPBot',
  },
  {
    name: 'MIPS Pipelined Pipelined Processor',
    description:
      'Made designs for single-cycle, pipelined processors. Created using both VHDL and Verilog. Verified with python scripting. Optimized and Generated Layout',
    stack: ['VHDL', 'MIPS', 'Schematic'],
    sourceCode: 'https://github.com/rajsinghtech/MIPS-Pipelined-Processor',
    livePreview: 'https://github.com/rajsinghtech/MIPS-Pipelined-Processor',
  },
  {
    name: 'MTCP Network Protocol',
    description:
      'Allowed for the fast transfering of text files. Implemented across multiple threads to increase speed. Required mapping data being sent to a specific tcp connection on a specific thread.',
    stack: ['C', 'TCP/IP', 'Networking'],
    sourceCode: 'https://github.com/JMcGhee-CPE/MTCP-Network-Protocol',
    livePreview: 'https://github.com/JMcGhee-CPE/MTCP-Network-Protocol',
  },
  {
    name: 'UDP Stream Introduce Error',
    description:
      'Wrote a UDP socket server and client with the ability to introduce error of dropped packets to get an idea of what occurs to the stream as you increase % error',
    stack: ['UDP', 'C', 'VLC'],
    sourceCode: 'https://github.com/rajsinghtech/UDP-stream-introduce-error',
    livePreview: 'https://github.com/rajsinghtech/UDP-stream-introduce-error',
  },
  {
    name: 'Better Bots Senior Design',
    description:
      'Working on a integrating an FPGA to allow for other programmers to interface with sensors, cameras, and Audio to Digital converters over USB. My role in this is to work on the acutal design specifications as well as flash/program the interface between the diffrent peripherals.',
    stack: ['Linux', 'C', 'Python', 'LiteX', 'Assembly'],
    sourceCode: 'https://www.betterbots.com/',
    livePreview: 'https://www.betterbots.com/',
  },
]

const skills = [
  // skills can be added or removed
  // if there are no skills, Skills section won't show up
  'HTML',
  'CSS',
  'JavaScript',
  'TCP/IP',
  'Linux',
  'Java',
  'Docker',
  'Virtualization',
  'Git',
  'CI/CD',
  'Python',
  'C',
  'Infrastructure automation',
  'Cloud computing',
  'Containerization',
  'Networking',
  'Computer Organization',
  'Digital Logic',
  'Circuit Design',
  'IT Operations',
  'Vulnerability Assessment'
]

const contact = {
  // email is optional - if left empty Contact section won't show up
  email: 'rajsinghcpre@gmail.com',
}

export { header, about, projects, skills, contact }
