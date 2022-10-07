const header = {
  // all the properties are optional - can be left empty or deleted
  homepage: 'https://rajsinghtech.github.io/portfolio/',
  title: 'Raj Singh.',
}

const about = {
  // all the properties are optional - can be left empty or deleted
  name: 'Raj Singh',
  role: 'Network Engineer',
  description:
    'Looking for a challenging position in an IT Company where I can use my capabilities and learn everything which contributes to the growth of the organization. I have a passion for networking infrastructure, IT, and integrated systems.',
  resume: 'https://rajsinghtech.github.io/portfolio/',
  social: {
    linkedin: 'https://www.linkedin.com/in/rajsingh360/',
    github: 'https://github.com/rajsinghtech',
  },
}

const projects = [
  // projects can be added an removed
  // if there are no projects, Projects section won't show up
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
    name: 'Better Bots Senior Design (In Progress)',
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
]

const contact = {
  // email is optional - if left empty Contact section won't show up
  email: 'rajsinghcpre@gmail.com',
}

export { header, about, projects, skills, contact }
