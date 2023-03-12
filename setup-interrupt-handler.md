
# Setting up ESP8266 Interrupts

How do I set up a gpio interrupt in esp8266 with SDK v2?

To set up a GPIO interrupt in ESP8266 with SDK 2, you can follow these steps:

First, you need to initialize the GPIO module by calling the gpio_init() function. This function should be called only once during the startup of your application.

Next, you need to configure the GPIO pin that you want to use for the interrupt. You can do this by calling the gpio_pin_intr_state_set() function. This function takes two arguments: the GPIO pin number and the interrupt mode. The interrupt mode can be one of the following:

GPIO_PIN_INTR_DISABLE: Disable interrupt
GPIO_PIN_INTR_PO`SEDGE: Interrupt on positive edge
GPIO_PIN_INTR_NEGEDGE: Interrupt on negative edge
GPIO_PIN_INTR_ANYEDGE: Interrupt on any edge
GPIO_PIN_INTR_LOLEVEL: Interrupt on low level
GPIO_PIN_INTR_HILEVEL: Interrupt on high level
After configuring the GPIO pin, you need to register an interrupt handler function using the gpio_intr_handler_register() function. This function takes two arguments: the interrupt handler function and a void pointer that will be passed to the interrupt handler function when it is called.

Finally, you can enable the GPIO interrupt by calling the gpio_pin_intr_state_set() function again, this time passing the GPIO_PIN_INTR_ANYEDGE value as the interrupt mode.

Here is some sample code to illustrate these steps:

```C
#include "gpio.h"

void gpio_intr_handler(uint32_t gpio_num) {
      // Interrupt handler function
          // TODO: handle the interrupt here
}

void setup_gpio_interrupt() {
      // Initialize the GPIO module
          gpio_init();

              // Configure GPIO pin 5 for interrupt on any edge
                  gpio_pin_intr_state_set(GPIO_ID_PIN(5), GPIO_PIN_INTR_ANYEDGE);

                      // Register the interrupt handler function
                          gpio_intr_handler_register(gpio_intr_handler, NULL);

                              // Enable the GPIO interrupt
                                  gpio_pin_intr_state_set(GPIO_ID_PIN(5), GPIO_PIN_INTR_ANYEDGE);
}
}}
```

In this example, we have set up an interrupt for GPIO pin 5. When the interrupt is triggered, the gpio_intr_handler() function will be called. You can replace the TODO comment in this function with your own code to handle the interrupt.
}
}